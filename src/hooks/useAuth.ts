import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type UserProfile = Database['public']['Tables']['profiles']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];
type CompanyMembership = {
  company_id: string;
  role: Database['pj']['Enums']['member_role'];
  company: Company;
};
type PendingCompanyPayload = {
  company_name: string;
  cnpj: string | null;
  monthly_revenue: number | null;
};

// Note: We use 'users_decrypted' view which automatically decrypts CNPJ data

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [companyMemberships, setCompanyMemberships] = useState<CompanyMembership[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyMembership | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const pendingCompanyPayload = useRef<PendingCompanyPayload | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchCompanyMemberships = useCallback(async (
    userId: string,
    attemptEnsure: boolean = true,
    profileData?: UserProfile | null
  ) => {
    setCompanyLoading(true);
    try {
      const effectiveProfile = profileData ?? profile;

      const { data, error } = await supabase
        .from('company_members')
        .select(`
          company_id,
          role,
          companies (
            id,
            name,
            trade_name,
            created_by,
            cnpj_encrypted,
            email,
            phone,
            monthly_revenue,
            metadata,
            created_at,
            updated_at
          )
        `)
        .eq('profile_id', userId);

      if (error) throw error;

      const normalized: CompanyMembership[] =
        data?.map((membership: any) => ({
          company_id: membership.company_id,
          role: membership.role,
          company: membership.companies as Company,
        })).filter((membership: CompanyMembership) => Boolean(membership.company)) ?? [];

      if ((normalized?.length ?? 0) === 0 && attemptEnsure && effectiveProfile?.user_type === 'pessoa_juridica') {
        const ensurePayload = pendingCompanyPayload.current ?? {
          company_name: effectiveProfile?.company_name ?? effectiveProfile?.full_name ?? 'Empresa',
          cnpj: null,
          monthly_revenue:
            effectiveProfile?.monthly_income != null
              ? Number(effectiveProfile.monthly_income)
              : 0,
        };

        try {
          await supabase.rpc('pg_ensure_company_for_user', {
            payload: {
              company_name: ensurePayload.company_name,
              cnpj: ensurePayload.cnpj,
              monthly_revenue: Number(ensurePayload.monthly_revenue ?? 0),
            },
          });
        } catch (ensureError) {
          console.error('Error ensuring company for user:', ensureError);
        }
        pendingCompanyPayload.current = null;
        await fetchCompanyMemberships(userId, false, effectiveProfile);
        return;
      }

      setCompanyMemberships(normalized);
      setActiveCompany(prev => {
        if (prev) {
          const match = normalized.find((membership) => membership.company_id === prev.company_id);
          if (match) {
            return match;
          }
        }
        return normalized[0] ?? null;
      });

      if ((normalized?.length ?? 0) > 0) {
        pendingCompanyPayload.current = null;
      }
    } catch (error) {
      console.error('Error fetching company memberships:', error);
      setCompanyMemberships([]);
      setActiveCompany(null);
    } finally {
      setCompanyLoading(false);
    }
  }, [profile, supabase]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);

      if (data?.user_type === 'pessoa_juridica') {
        await fetchCompanyMemberships(userId, true, data);
      } else {
        setCompanyMemberships([]);
        setActiveCompany(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, userData: {
    name: string;
    user_type: 'pf' | 'pj';
    company_name?: string;
    cnpj?: string;
    monthly_revenue?: number;
  }) => {
    // Convert short user_type to database enum
    const userTypeMap = {
      'pf': 'pessoa_fisica' as const,
      'pj': 'pessoa_juridica' as const,
    };
    const cleanedCnpj = userData.cnpj?.replace(/\D/g, '') ?? null;
    if (userData.user_type === 'pj') {
      pendingCompanyPayload.current = {
        company_name: userData.company_name ?? userData.name,
        cnpj: cleanedCnpj,
        monthly_revenue: userData.monthly_revenue ?? null,
      };
    } else {
      pendingCompanyPayload.current = null;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: userData.name,
          user_type: userData.user_type, // Will be converted by trigger
        },
      },
    });

    if (error) throw error;

    // Wait for the trigger to create the user profile
    if (data.user && data.session) {
      // Give the trigger time to execute
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update profile with complete data
      // If CNPJ is provided, encrypt it
      let updateData: any = {
        full_name: userData.name,
        user_type: userTypeMap[userData.user_type],
        company_name: userData.company_name,
      };

      if (cleanedCnpj) {
        const { data: encryptedCnpj } = await supabase.rpc('encrypt_sensitive', {
          data: cleanedCnpj,
        });
        updateData.cnpj_encrypted = encryptedCnpj;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', data.user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        // Don't throw, profile was created by trigger
      }

      if (userData.user_type === 'pj') {
        try {
          const payload = pendingCompanyPayload.current ?? {
            company_name: userData.company_name ?? userData.name,
            cnpj: cleanedCnpj,
            monthly_revenue: userData.monthly_revenue ?? null,
          };

          await supabase.rpc('pg_create_company_with_owner', {
            payload: {
              company_name: payload.company_name,
              cnpj: payload.cnpj,
              monthly_revenue: Number(payload.monthly_revenue ?? 0),
            },
          });
        } catch (companyError) {
          console.error('Error creating company for user:', companyError);
        }
      }

      await fetchProfile(data.user.id);
    }

    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setCompanyMemberships([]);
    setActiveCompany(null);
    navigate('/');
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');

    // Encrypt CNPJ if provided
    let updateData: any = { ...updates };
    if (updates.cnpj) {
      const { data: encryptedCnpj } = await supabase.rpc('encrypt_sensitive', {
        data: updates.cnpj,
      });
      updateData.cnpj_encrypted = encryptedCnpj;
      delete updateData.cnpj; // Remove plain CNPJ
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (error) throw error;

    // Fetch updated profile
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(updatedProfile);
    return updatedProfile;
  };

  const selectCompanyById = useCallback((companyId: string | null) => {
    if (!companyId) {
      setActiveCompany(null);
      return;
    }

    setActiveCompany(prev => {
      const match = companyMemberships.find((membership) => membership.company_id === companyId);
      return match ?? prev ?? null;
    });
  }, [companyMemberships]);

  const refreshCompanyMemberships = useCallback(async () => {
    if (user?.id) {
      await fetchCompanyMemberships(user.id);
    }
  }, [user, fetchCompanyMemberships]);

  return {
    user,
    profile,
    loading,
    companyLoading,
    companyMemberships,
    activeCompany,
    setActiveCompany: selectCompanyById,
    refreshCompanyMemberships,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };
};
