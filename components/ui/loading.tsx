import { Spinner } from '@/components/ui/spinner'

type LoadingProps = {
  className?: string
  message?: string
}

export function Loading({ className = '', message }: LoadingProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center bg-white ${className}`.trim()}>
      <div className="flex flex-col items-center">
        <Spinner className="w-12 h-12 text-gray-900" />
        {message ? (
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </div>
  )
}

export default Loading
