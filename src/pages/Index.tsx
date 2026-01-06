import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MessageCircle, Shield, Link2, ArrowRight } from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/chats');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen gradient-bg overflow-hidden">
      {/* Hero Section */}
      <div className="relative">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 py-20 sm:py-32">
          {/* Logo */}
          <div className="flex items-center justify-center mb-12 animate-fade-in">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center glow-effect animate-pulse-glow">
              <MessageCircle className="w-10 h-10 text-primary" />
            </div>
          </div>

          {/* Headline */}
          <div className="text-center space-y-6 animate-slide-up">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="text-foreground">Private chats,</span>
              <br />
              <span className="gradient-text">your way</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Connect with anyone using unique codes. No phone numbers, no usernames to remember — just simple, secure messaging.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Link to="/auth">
                <Button variant="hero" size="xl" className="group">
                  Get Started
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="mt-24 grid sm:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <FeatureCard
              icon={<Link2 className="w-6 h-6" />}
              title="Code-Based Connection"
              description="Share a unique 8-character code to connect instantly with anyone."
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Private & Secure"
              description="Your conversations stay between you and your contacts."
            />
            <FeatureCard
              icon={<MessageCircle className="w-6 h-6" />}
              title="Real-Time Chat"
              description="Messages appear instantly with live updates."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-6 hover:shadow-glow transition-all duration-300 group">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
