// TEMPORARILY DISABLED FOR STATIC EXPORT
// Static export doesn't support dynamic routes with dynamicParams
// TODO: Re-enable when moving away from static export or redesign without dynamic routes

export default function SensorDetailsPage() {
  return (
    <div className="container mx-auto p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Sensor Details</h1>
        <p className="text-muted-foreground">
          This page is temporarily unavailable in the static export build.
        </p>
      </div>
    </div>
  )
}

