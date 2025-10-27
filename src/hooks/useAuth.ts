import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type UserProfile = Database['public']['Tables']['profiles']['Row'];

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
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
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: userData.name,
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
        name: userData.name,
        user_type: userData.user_type,
        company_name: userData.company_name,
      };

      if (userData.cnpj) {
        const { data: encryptedCnpj } = await supabase.rpc('encrypt_sensitive', {
          data: userData.cnpj,
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

  return {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };
};
