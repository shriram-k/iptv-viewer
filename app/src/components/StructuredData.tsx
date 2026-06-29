import { toJsonLd } from '../lib/jsonld'

// Inject a JSON-LD <script>. Value is escaped so untrusted channel names can't
// break out of the script element (origin R14 carried into the render layer).
export function StructuredData({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(data) }} />
}
