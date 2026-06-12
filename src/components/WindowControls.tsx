import { useNavigate } from 'react-router-dom';

interface Props {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

/** macOS-style traffic-light window controls (red/yellow/green). */
export function WindowControls({ onClose, onMinimize, onMaximize }: Props) {
  const navigate = useNavigate();

  const handleClose = () => {
    if (onClose) return onClose();
    navigate('/chats');
  };

  const handleMinimize = () => {
    if (onMinimize) return onMinimize();
    navigate('/chats');
  };

  const handleMaximize = async () => {
    if (onMaximize) return onMaximize();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignored */
    }
  };

  const dot =
    'w-3 h-3 rounded-full border border-black/20 shadow-inner transition-transform hover:scale-110 active:scale-95 focus:outline-none';

  return (
    <div className="flex items-center gap-1.5 group/wc" aria-label="Window controls">
      <button
        type="button"
        onClick={handleClose}
        title="Close"
        aria-label="Close"
        className={`${dot} bg-[#ff5f57] hover:bg-[#ff7268]`}
      />
      <button
        type="button"
        onClick={handleMinimize}
        title="Minimize"
        aria-label="Minimize"
        className={`${dot} bg-[#febc2e] hover:bg-[#ffce5c]`}
      />
      <button
        type="button"
        onClick={handleMaximize}
        title="Maximize"
        aria-label="Maximize"
        className={`${dot} bg-[#28c840] hover:bg-[#4ed967]`}
      />
    </div>
  );
}
