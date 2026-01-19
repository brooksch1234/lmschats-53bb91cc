import { MessageCircle, UserPlus, Hash, Palette, Sparkles, Shield, Users } from 'lucide-react';

const tips = [
  { icon: UserPlus, title: 'Add Friends', description: 'Connect with others by code or find nearby users' },
  { icon: Hash, title: 'Share Your Code', description: 'Give your unique code to friends to connect' },
  { icon: Users, title: 'Create Groups', description: 'Start group chats with your connections' },
  { icon: Palette, title: 'Customize', description: 'Choose themes and display your tags' },
  { icon: Sparkles, title: 'React & Reply', description: 'Add emoji reactions to messages' },
  { icon: Shield, title: 'Stay Safe', description: 'Your messages are private and secure' },
];

export default function ChatWelcome() {
  return (
    <div className="flex-1 flex items-center justify-center gradient-bg p-6">
      <div className="text-center max-w-2xl">
        {/* Hero */}
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3">Welcome to LMS Chats</h2>
        <p className="text-muted-foreground mb-8 text-lg">
          Select a conversation from the sidebar to start chatting, or add a friend using the toolbar above.
        </p>

        {/* Tips Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {tips.map((tip) => (
            <div
              key={tip.title}
              className="glass-card rounded-xl p-4 text-left hover:bg-accent/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <tip.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1">{tip.title}</h3>
              <p className="text-xs text-muted-foreground">{tip.description}</p>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-xs text-muted-foreground mt-8">
          💡 Tip: Click on user avatars to view their profile
        </p>
      </div>
    </div>
  );
}