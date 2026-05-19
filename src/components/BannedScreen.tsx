import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

interface BannedScreenProps {
  reason: string;
  expiresAt: string | null;
  onSignOut: () => void;
}

export function BannedScreen({ reason, expiresAt, onSignOut }: BannedScreenProps) {
  const isPermanent = !expiresAt;
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl border border-red-500/40 rounded-2xl p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isPermanent ? 'Account banned' : 'Account temporarily suspended'}
          </h1>
          <p className="text-slate-400 text-sm">
            {isPermanent
              ? 'Your account has been permanently banned by an administrator.'
              : `Your access is suspended until ${format(new Date(expiresAt!), 'MMM d, yyyy · h:mm a')}.`}
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 text-left">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Reason</p>
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{reason}</p>
        </div>
        <Button variant="destructive" className="w-full" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
