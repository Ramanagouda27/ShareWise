
import { useMemo, useState } from 'react'
import './App.css'

type Resource = {
  id: number
  name: string
  category: string
  location: string
  owner: string
  available: boolean
  icon: string
  description: string
}

const resources: Resource[] = [
  {
    id: 1,
    name: 'Arduino Starter Kit',
    category: 'Electronics',
    location: 'Innovation Lab',
    owner: 'Electronics Club',
    available: true,
    icon: '⚡',
    description: 'Microcontroller, sensors and essential prototyping components.',
  },
  {
    id: 2,
    name: 'Digital Oscilloscope',
    category: 'Electronics',
    location: 'Electronics Lab',
    owner: 'Lab Administration',
    available: true,
    icon: '〰️',
    description: 'Measure and analyze electronic signals for lab experiments.',
  },
  {
    id: 3,
    name: '3D Printer',
    category: 'Workshop',
    location: 'Makerspace',
    owner: 'Makerspace Team',
    available: false,
    icon: '🖨️',
    description: 'Create prototypes and custom parts for engineering projects.',
  },
  {
    id: 4,
    name: 'DSLR Camera',
    category: 'Media',
    location: 'Media Centre',
    owner: 'Media Club',
    available: true,
    icon: '📷',
    description: 'Capture project demonstrations, events and product prototypes.',
  },
  {
    id: 5,
    name: 'Robotics Tool Set',
    category: 'Workshop',
    location: 'Innovation Lab',
    owner: 'Robotics Club',
    available: true,
    icon: '🛠️',
    description: 'Essential hand tools for building and maintaining robots.',
  },
  {
    id: 6,
    name: 'Portable Projector',
    category: 'Media',
    location: 'Seminar Hall',
    owner: 'AV Support Team',
    available: true,
    icon: '📽️',
    description: 'Present your project, demo or classroom presentation.',
  },
]

const categories = ['All resources', 'Electronics', 'Workshop', 'Media']

function App() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All resources')
  const [requests, setRequests] = useState<number[]>([])
  const [notice, setNotice] = useState('')

  const filteredResources = useMemo(() => {
    const query = search.trim().toLowerCase()

    return resources.filter((resource) => {
      const matchesCategory =
        category === 'All resources' || resource.category === category

      const matchesSearch =
        !query ||
        `${resource.name} ${resource.description} ${resource.location} ${resource.owner}`
          .toLowerCase()
          .includes(query)

      return matchesCategory && matchesSearch
    })
  }, [search, category])

  function requestBooking(resource: Resource) {
    if (!resource.available) return

    setRequests((current) =>
      current.includes(resource.id) ? current : [...current, resource.id],
    )
    setNotice(`Request prepared for ${resource.name}.`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="ShareWise home">
          <span className="brand-mark">S</span>
          <span>share<span className="brand-accent">wise</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#discover">
            <span>⌂</span> Discover
          </a>
          <a className="nav-link" href="#resources">
            <span>▤</span> Resources
          </a>
          <a className="nav-link" href="#my-requests">
            <span>◷</span> My requests
            {requests.length > 0 && (
              <span className="nav-count">{requests.length}</span>
            )}
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">✳</span>
            <h3>Make more with less.</h3>
            <p>Share equipment, reduce waste and build something great together.</p>
          </div>
          <div className="profile">
            <div className="avatar">S</div>
            <div>
              <strong>Student workspace</strong>
              <span>Campus community</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content" id="discover">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Discover</div>
          <div className="topbar-right">
            <span className="status-dot" />
            Campus resources
            <div className="avatar small">S</div>
          </div>
        </header>

        <section className="welcome-section">
          <div className="welcome-copy">
            <div className="eyebrow"><span /> THE CAMPUS SHARING NETWORK</div>
            <h1>Great things happen<br />when we <span>share.</span></h1>
            <p>
              Discover the equipment, tools and resources you need.
              Borrow responsibly. Build together.
            </p>
            <a className="primary-button hero-button" href="#resources">
              Explore resources <span>↗</span>
            </a>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-circle circle-back" />
            <div className="art-circle circle-front">
              <span>✳</span>
            </div>
            <div className="floating-card card-top">
              <span>⚡</span>
              <div><strong>Tools shared</strong><small>Ideas in motion</small></div>
            </div>
            <div className="floating-card card-bottom">
              <span>↗</span>
              <div><strong>Built together</strong><small>Better campus, less waste</small></div>
            </div>
          </div>
        </section>

        <section className="stats-grid" aria-label="Resource overview">
          <div className="stat-card">
            <span className="stat-icon green">▤</span>
            <div><span>Listed resources</span><strong>{resources.length.toString().padStart(2, '0')}</strong></div>
          </div>
          <div className="stat-card">
            <span className="stat-icon blue">✓</span>
            <div><span>Available now</span><strong>{resources.filter((r) => r.available).length.toString().padStart(2, '0')}</strong></div>
          </div>
          <div className="stat-card">
            <span className="stat-icon purple">◷</span>
            <div><span>Your requests</span><strong>{requests.length.toString().padStart(2, '0')}</strong></div>
          </div>
        </section>

        <section className="resources-section" id="resources">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE COMMUNITY INVENTORY</div>
              <h2>Find your next resource</h2>
              <p>Equipment shared by students, labs and campus clubs.</p>
            </div>
            <span className="results-count">{filteredResources.length} resources</span>
          </div>

          <div className="resource-controls">
            <label className="search-box">
              <span>⌕</span>
              <input
                aria-label="Search resources"
                placeholder="Search equipment, labs, clubs..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search">×</button>
              )}
            </label>

            <div className="category-filters" aria-label="Filter by category">
              {categories.map((item) => (
                <button
                  key={item}
                  className={`filter-button ${category === item ? 'selected' : ''}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {notice && (
            <div className="notice" role="status">
              <span>✓</span> {notice}
              <button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button>
            </div>
          )}

          <div className="resource-grid">
            {filteredResources.map((resource) => {
              const requested = requests.includes(resource.id)

              return (
                <article className="resource-card" key={resource.id}>
                  <div className={`resource-visual visual-${resource.category.toLowerCase()}`}>
                    <span className="resource-emoji">{resource.icon}</span>
                    <span className={`availability ${resource.available ? 'available' : 'unavailable'}`}>
                      <span />{resource.available ? 'Available' : 'Currently borrowed'}
                    </span>
                    <span className="resource-id">SW-{String(resource.id).padStart(3, '0')}</span>
                  </div>

                  <div className="resource-details">
                    <span className="resource-category">{resource.category}</span>
                    <h3>{resource.name}</h3>
                    <p>{resource.description}</p>

                    <div className="resource-meta">
                      <span>⌖ {resource.location}</span>
                      <span>♙ {resource.owner}</span>
                    </div>

                    <button
                      className={`request-button ${requested ? 'requested' : ''}`}
                      disabled={!resource.available || requested}
                      onClick={() => requestBooking(resource)}
                    >
                      {!resource.available
                        ? 'Currently unavailable'
                        : requested
                          ? '✓ Request prepared'
                          : 'Request to borrow'}
                      {resource.available && !requested && <span>→</span>}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {filteredResources.length === 0 && (
            <div className="empty-state">
              <span>⌕</span>
              <h3>No matching resources</h3>
              <p>Try another search term or choose a different category.</p>
              <button
                className="filter-button selected"
                onClick={() => { setSearch(''); setCategory('All resources') }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section className="requests-section" id="my-requests">
          <div className="section-heading">
            <div>
              <div className="eyebrow">YOUR ACTIVITY</div>
              <h2>My booking requests</h2>
              <p>Requests prepared during this session.</p>
            </div>
            <span className="results-count">{requests.length} requests</span>
          </div>

          {requests.length === 0 ? (
            <div className="empty-requests">
              <span>◷</span>
              <div>
                <strong>No requests yet</strong>
                <p>Find a resource above and select “Request to borrow” to get started.</p>
              </div>
            </div>
          ) : (
            <div className="request-list">
              {resources.filter((resource) => requests.includes(resource.id)).map((resource) => (
                <div className="request-row" key={resource.id}>
                  <span className="request-row-icon">{resource.icon}</span>
                  <div className="request-row-info">
                    <strong>{resource.name}</strong>
                    <span>{resource.location} · {resource.owner}</span>
                  </div>
                  <span className="request-pending">Demo request</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="footer">
          <a className="footer-brand" href="#discover">share<span>wise</span></a>
          <span>Share resources. Create possibilities.</span>
          <span>Campus sharing prototype · Demo data</span>
        </footer>
      </main>
    </div>
  )
}

export default App
