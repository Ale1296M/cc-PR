import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/care-plan')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/app/care-plan"!</div>
}
