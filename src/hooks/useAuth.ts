import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { resolveTenantSlug } from '@/lib/tenant';
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
  const attemptedTenantRepair = useRef(false);

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

      // Auto-sync browser timezone to company (fire-and-forget)
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const target = normalized[0];
      if (target && browserTz) {
        supabase
          .from('companies')
          .update({ timezone: browserTz })
          .eq('id', target.company_id)
          .then(({ error: tzError }) => {
            if (tzError) console.warn('Could not sync timezone:', tzError.message);
          });
      }

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
      let nextProfile = data;

      if (!attemptedTenantRepair.current && !data?.tenant_id) {
        const tenantSlug = resolveTenantSlug();
        if (tenantSlug) {
          attemptedTenantRepair.current = true;
          const { data: tenantData } = await supabase
            .from('tenants' as any)
            .select('id')
            .eq('slug', tenantSlug)
            .eq('is_active', true)
            .maybeSingle();

          if (tenantData?.id) {
            const { data: updatedProfile } = await supabase
              .from('profiles')
              .update({ tenant_id: tenantData.id })
              .eq('id', userId)
              .select('*')
              .single();

            if (updatedProfile) {
              nextProfile = updatedProfile;
            }
          }
        }
      }

      setProfile(nextProfile);

      if (nextProfile?.user_type === 'pessoa_juridica') {
        await fetchCompanyMemberships(userId, true, nextProfile);
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

  const signUp = async (
    credentials: { email?: string; phone?: string; password: string },
    userData: {
      name: string;
      company_name?: string;
      cnpj?: string;
      monthly_revenue?: number;
    },
  ) => {
    const cleanedCnpj = userData.cnpj?.replace(/\D/g, '') ?? null;
    pendingCompanyPayload.current = {
      company_name: userData.company_name ?? userData.name,
      cnpj: cleanedCnpj,
      monthly_revenue: userData.monthly_revenue ?? null,
    };

    const { email, phone, password } = credentials;
    const tenantSlug = resolveTenantSlug();

    const { data, error } = await supabase.auth.signUp({
      email,
      phone,
      password,
      options: {
        data: {
          name: userData.name,
          user_type: 'pj', // Will be converted by trigger
          tenant_slug: tenantSlug,
        },
      },
    });

    if (error) throw error;

    if (data.user && data.session) {
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

    const userId = data.user?.id;
    if (!userId) {
      await supabase.auth.signOut();
      throw new Error('Usuário ou senha inválidos');
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', userId)
      .single();

    if (profileError || profileData?.user_type !== 'pessoa_juridica') {
      await supabase.auth.signOut();
      throw new Error('Usuário ou senha inválidos');
    }

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
