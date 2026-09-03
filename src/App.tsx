import SpikePage from './spike/SpikePage'

// No router. The design navigates with a two-tab bar rather than URLs, so a
// router may never earn its place — S3 introduces real navigation when there is
// a second screen to navigate to. Until then a path check is enough.

export default function App() {
  if (window.location.pathname.startsWith('/spike')) return <SpikePage />

  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: '#7c8190', fontSize: '0.875rem' }}>
        Nothing here yet — S1 builds the log surface.
        <br />
        <a href="/spike" style={{ color: '#7c8190' }}>/spike</a> is the smoke test.
      </p>
    </main>
  )
}
