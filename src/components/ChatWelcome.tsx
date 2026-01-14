import { MessageCircle } from 'lucide-react';

export default function ChatWelcome() {
  return (
    <div className="flex-1 flex items-center justify-center gradient-bg">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-3">Welcome to LMS Chats</h2>
        <p className="text-muted-foreground">
          Select a conversation from the sidebar to start chatting, or add a friend using the toolbar above.
        </p>
      </div>
    </div>
  );
}
