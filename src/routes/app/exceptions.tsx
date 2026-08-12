import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/exceptions')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/app/exceptions"!</div>
}
