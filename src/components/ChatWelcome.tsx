import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  MessageCircle, UserPlus, Hash, Palette, Users, Gamepad2,
  ShoppingBag, Sparkles, Copy, Check, ArrowRight, Globe, Bell, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnlineIndicator } from '@/components/OnlineIndicator';

interface RecentChat {
  id: string;
  username: string;
  user_id: string;
  last_message: string;
  type: 'dm';
}
interface RecentGroup {
  id: string;
  name: string;
  member_count: number;
  type: 'group';
}

export default function ChatWelcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [recents, setRecents] = useState<RecentChat[]>([]);
  const [groups, setGroups] = useState<RecentGroup[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, connection_code')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) {
        setCode(profile.connection_code || '');
        setUsername(profile.username || '');
      }

      const { data: conns } = await supabase
        .from('connections')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .limit(8);

      const enriched: RecentChat[] = await Promise.all(
        (conns || []).map(async (c: any) => {
          const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
          const { data: p } = await supabase
            .from('profiles').select('id, username').eq('id', otherId).maybeSingle();
          const { data: last } = await supabase
            .from('messages').select('content, message_type')
            .eq('connection_id', c.id).order('created_at', { ascending: false })
            .limit(1).maybeSingle();
          let lastMsg = 'Say hi 👋';
          if (last) {
            if (last.message_type === 'image') lastMsg = '📷 Image';
            else if (last.message_type === 'voice') lastMsg = '🎤 Voice';
            else lastMsg = last.content || lastMsg;
          }
          return { id: c.id, username: p?.username || 'Unknown', user_id: otherId, last_message: lastMsg, type: 'dm' as const };
        })
      );
      setRecents(enriched.slice(0, 4));
      setFriendCount(enriched.length);

      const { data: memberships } = await supabase
        .from('group_members').select('group_id').eq('user_id', user.id);
      if (memberships?.length) {
        const ids = memberships.map((m: any) => m.group_id);
        const { data: gs } = await supabase
          .from('group_chats').select('*').in('id', ids).limit(3);
        const gEnriched: RecentGroup[] = await Promise.all(
          (gs || []).map(async (g: any) => {
            const { count } = await supabase.from('group_members')
              .select('*', { count: 'exact', head: true }).eq('group_id', g.id);
            return { id: g.id, name: g.name, member_count: count || 0, type: 'group' as const };
          })
        );
        setGroups(gEnriched);
      }

      const { count: reqCount } = await supabase
        .from('friend_requests')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('status', 'pending');
      setPendingRequests(reqCount || 0);
    })();
  }, [user]);

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: 'Code copied', description: 'Share it with a friend.' });
    setTimeout(() => setCopied(false), 1800);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="flex-1 overflow-y-auto gradient-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-primary/80 mb-2">
              {greeting.toUpperCase()}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
              Hey <span className="gradient-text">@{username || '...'}</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Your hub for messages, groups, themes & games.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            online · live sync active
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 auto-rows-[min-content]">
          {/* Connection code — large */}
          <button
            onClick={copyCode}
            className="group relative col-span-2 md:col-span-2 lg:col-span-3 rounded-3xl p-6 text-left overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent hover:border-primary/60 transition-all duration-300 hover:-translate-y-0.5 shadow-card hover:shadow-glow"
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/20 blur-3xl group-hover:bg-primary/30 transition-colors" />
            <div className="relative flex items-start justify-between mb-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-mono">
                <Hash className="w-3.5 h-3.5" /> Your Code
              </div>
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />}
            </div>
            <div className="relative font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[0.25em] text-foreground">
              {code ? code.toUpperCase() : '••••••••'}
            </div>
            <p className="relative text-xs text-muted-foreground mt-3">Tap to copy · share to get added</p>
          </button>

          {/* Add friends */}
          <ActionTile
            icon={UserPlus}
            label="Add Friend"
            sub="Code · search · nearby"
            badge={pendingRequests > 0 ? `${pendingRequests} pending` : undefined}
            accent="from-violet-500/30 to-fuchsia-500/5"
            onClick={() => {
              const btn = document.querySelector<HTMLButtonElement>('[data-add-friend-trigger]');
              btn?.click();
            }}
          />

          {/* Friends count */}
          <StatTile
            icon={Users}
            label="Friends"
            value={friendCount}
            accent="from-sky-500/30 to-indigo-500/5"
          />

          {/* New chat / group */}
          <ActionTile
            icon={Sparkles}
            label="New Group"
            sub="Multi-user room"
            accent="from-amber-500/30 to-rose-500/5"
            onClick={() => {
              const btn = document.querySelector<HTMLButtonElement>('[data-create-group-trigger]');
              btn?.click();
            }}
          />

          {/* Recent chats — wide row */}
          <div className="col-span-2 md:col-span-4 lg:col-span-4 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-foreground flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" /> Recent Chats
              </h2>
              {recents.length > 0 && (
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {recents.length} active
                </span>
              )}
            </div>
            {recents.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">No chats yet — share your code to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recents.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/chat/${c.id}`)}
                    className="group flex items-center gap-3 p-3 rounded-2xl bg-background/40 border border-border/40 hover:border-primary/40 hover:bg-background/60 transition-all"
                  >
                    <div className="relative w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {c.username.charAt(0).toUpperCase()}
                      </span>
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <OnlineIndicator userId={c.user_id} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-sm text-foreground truncate">{c.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Groups */}
          <div className="col-span-2 md:col-span-2 lg:col-span-2 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Groups
              </h2>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {groups.length}
              </span>
            </div>
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No groups yet.</p>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => navigate(`/group/${g.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-background/40 border border-border/40 hover:border-primary/40 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                      <p className="text-[11px] text-muted-foreground">{g.member_count} members</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Themes */}
          <ActionTile
            icon={Palette}
            label="Themes"
            sub="Animated bg"
            accent="from-fuchsia-500/30 to-pink-500/5"
            onClick={() => {
              const btn = document.querySelector<HTMLButtonElement>('[data-theme-trigger]');
              btn?.click();
            }}
          />

          {/* Games */}
          <ActionTile
            icon={Gamepad2}
            label="Mini-Games"
            sub="Play instantly"
            accent="from-emerald-500/30 to-teal-500/5"
            onClick={() => {
              const btn = document.querySelector<HTMLButtonElement>('[data-games-trigger]');
              btn?.click();
            }}
          />

          {/* Shop */}
          <ActionTile
            icon={ShoppingBag}
            label="Shop"
            sub="Merch & perks"
            accent="from-orange-500/30 to-amber-500/5"
            onClick={() => navigate('/shop')}
          />

          {/* Proxy / web */}
          <ActionTile
            icon={Globe}
            label="Web Proxy"
            sub="Bypass filters"
            accent="from-indigo-500/30 to-blue-500/5"
            onClick={() => {
              const btn = document.querySelector<HTMLButtonElement>('[data-proxy-trigger]');
              btn?.click();
            }}
          />
        </div>

        <p className="text-[11px] text-muted-foreground/60 mt-8 text-center font-mono">
          // tip · open a chat from the recents list above
        </p>
      </div>
    </div>
  );
}

function ActionTile({
  icon: Icon, label, sub, accent, onClick, badge,
}: {
  icon: any; label: string; sub: string; accent: string; onClick?: () => void; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative col-span-1 md:col-span-1 lg:col-span-1 aspect-square sm:aspect-auto sm:h-32 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 text-left overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
      <div className="relative h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl bg-background/70 backdrop-blur border border-border/50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          {badge && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/30 text-primary-foreground border border-primary/40">
              {badge}
            </span>
          )}
        </div>
        <div>
          <h3 className="font-display font-bold text-foreground text-sm">{label}</h3>
          <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>
        </div>
      </div>
    </button>
  );
}

function StatTile({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent: string; }) {
  return (
    <div className="relative col-span-1 md:col-span-1 lg:col-span-1 aspect-square sm:aspect-auto sm:h-32 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-60`} />
      <div className="relative h-full flex flex-col justify-between">
        <div className="w-9 h-9 rounded-xl bg-background/70 backdrop-blur border border-border/50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="font-display font-bold text-foreground text-2xl leading-none">{value}</div>
          <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}
