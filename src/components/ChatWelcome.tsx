import { MessageCircle, UserPlus, Hash, Palette, Sparkles, Users, Gamepad2 } from 'lucide-react';

const tips = [
  { icon: UserPlus, title: 'Add Friends', description: 'Connect by code or nearby', accent: 'from-indigo-500/30 to-violet-500/10' },
  { icon: Hash, title: 'Your Code', description: 'Share to be added', accent: 'from-violet-500/30 to-fuchsia-500/10' },
  { icon: Users, title: 'Group Chats', description: 'Multi-person rooms', accent: 'from-sky-500/30 to-indigo-500/10' },
  { icon: Palette, title: 'Themes', description: 'Animated backgrounds', accent: 'from-fuchsia-500/30 to-indigo-500/10' },
  { icon: Sparkles, title: 'React & Poll', description: 'Emoji + live polls', accent: 'from-emerald-500/30 to-cyan-500/10' },
  { icon: Gamepad2, title: 'Mini-Games', description: 'Play while you chat', accent: 'from-amber-500/30 to-rose-500/10' },
];

export default function ChatWelcome() {
  return (
    <div className="flex-1 flex items-center justify-center gradient-bg p-6 overflow-y-auto">
      <div className="w-full max-w-4xl py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-glow shadow-glow mb-5">
            <MessageCircle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-3 tracking-tight">
            <span className="gradient-text">LMS</span> Chats
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto">
            Pick a conversation on the left — or use the toolbar to add a friend.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[7rem] gap-3">
          {tips.map((tip, i) => (
            <div
              key={tip.title}
              className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300 ${
                i === 0 ? 'md:col-span-2 md:row-span-2' : ''
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${tip.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
              <div className="relative h-full flex flex-col justify-between">
                <div className="w-9 h-9 rounded-xl bg-background/60 backdrop-blur flex items-center justify-center border border-border/50">
                  <tip.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-foreground text-sm mb-0.5">{tip.title}</h3>
                  <p className="text-xs text-muted-foreground leading-tight">{tip.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground/70 mt-8 text-center font-mono">
          // tip: click avatars to view profiles
        </p>
      </div>
    </div>
  );
}
