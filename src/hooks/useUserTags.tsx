import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserTag {
  name: string;
  color: string;
}

export function useUserTags(userId: string | undefined) {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setTags([]);
      setLoading(false);
      return;
    }

    const fetchTags = async () => {
      const { data, error } = await supabase
        .from('user_tags')
        .select(`
          custom_color,
          equipped,
          tags:tag_id (
            name,
            color
          )
        `)
        .eq('user_id', userId)
        .eq('equipped', true);

      if (error) {
        console.error('Error fetching user tags:', error);
        setTags([]);
      } else {
        const formattedTags = (data || [])
          .filter((ut: any) => ut.tags)
          .map((ut: any) => ({
            name: ut.tags.name,
            color: ut.custom_color || ut.tags.color,
          }));
        setTags(formattedTags);
      }
      setLoading(false);
    };

    fetchTags();
  }, [userId]);

  return { tags, loading };
}

export function useMultipleUserTags(userIds: string[]) {
  const [tagsMap, setTagsMap] = useState<Record<string, UserTag[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userIds.length === 0) {
      setTagsMap({});
      setLoading(false);
      return;
    }

    const fetchTags = async () => {
      const { data, error } = await supabase
        .from('user_tags')
        .select(`
          user_id,
          custom_color,
          equipped,
          tags:tag_id (
            name,
            color
          )
        `)
        .in('user_id', userIds)
        .eq('equipped', true);

      if (error) {
        console.error('Error fetching user tags:', error);
        setTagsMap({});
      } else {
        const map: Record<string, UserTag[]> = {};
        (data || []).forEach((ut: any) => {
          if (!ut.tags) return;
          if (!map[ut.user_id]) map[ut.user_id] = [];
          map[ut.user_id].push({
            name: ut.tags.name,
            color: ut.custom_color || ut.tags.color,
          });
        });
        setTagsMap(map);
      }
      setLoading(false);
    };

    fetchTags();
  }, [userIds.join(',')]);

  return { tagsMap, loading };
}
