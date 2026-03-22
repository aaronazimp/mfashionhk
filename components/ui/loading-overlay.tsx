import { Spinner } from '@/components/ui/spinner'

type LoadingOverlayProps = {
  message?: string
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      <div className="bg-white/95 dark:bg-black/80 rounded-lg p-6 flex flex-col items-center">
        <Spinner className="w-12 h-12 text-gray-900" />
        {message ? <p className="mt-3 text-sm text-gray-700">{message}</p> : null}
      </div>
    </div>
  )
}

export default LoadingOverlay
