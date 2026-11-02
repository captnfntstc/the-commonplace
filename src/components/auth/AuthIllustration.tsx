import React from 'react'
import {
  Bookmark,
  BookOpen,
  Film,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Music2,
  Quote,
  Star,
} from 'lucide-react'

export interface AuthIllustrationProps {
  accentColor?: string
}

export const AuthIllustration: React.FC<AuthIllustrationProps> = () => {
  return (
    <div className="auth-sanctuary-showcase" aria-hidden="true">
      {/* ── Top: Text describing what The Commonplace should be ── */}
      <div className="auth-sanctuary-intro">
        <h2 className="auth-sanctuary-title">
          A sanctuary for thoughts, quotes, and quiet reflections.
        </h2>
        <p className="auth-sanctuary-lead">
          Collect the words that linger. From passages and late-night songs to personal notes, keep what shapes you close.
        </p>
      </div>

      {/* ── Bottom: Tilted Cards Streaming Downward & Overflowing at the Bottom ── */}
      <div className="auth-feed-fade-container">
        {/* Soft fade overlay at top of cards stream */}
        <div className="auth-feed-top-fade-mask" />

        <div className="auth-feed-grid-overflow">
          {/* ── Column 1 ── */}
          <div className="auth-feed-col">
            {/* Card 1: Taylor Swift - The Outside */}
            <article className="auth-feed-card">
              <div className="auth-fcard-top">
                <div className="auth-fcard-user">
                  <span className="auth-fcard-avatar" style={{ background: '#dcfce7', color: '#16a34a' }}>
                    CB
                  </span>
                  <div className="auth-fcard-user-names">
                    <span className="auth-fcard-name">Clara Bennett</span>
                    <span className="auth-fcard-handle">@clarabennett</span>
                  </div>
                </div>
                <div className="auth-fcard-meta">
                  <span className="auth-fcard-time">8d</span>
                  <Music2 size={13} className="auth-fcard-type-icon" />
                </div>
              </div>

              <div className="auth-fcard-body">
                <div className="auth-fcard-art">
                  <img
                    src="/covers/taylor-swift-outside.jpg"
                    alt="Taylor Swift cover"
                    className="auth-fcard-cover-img"
                    loading="eager"
                  />
                </div>
                <div className="auth-fcard-info">
                  <div className="auth-fcard-stars">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={11} fill="#f5b74c" color="#f5b74c" />
                    ))}
                  </div>
                  <h4 className="auth-fcard-title">The Outside</h4>
                  <p className="auth-fcard-creator">Taylor Swift</p>
                  <div className="auth-fcard-badge-row">
                    <span className="auth-fcard-badge">COUNTRY</span>
                  </div>
                  <p className="auth-fcard-sub">Taylor Swift (Bonus Track Version)</p>
                </div>
              </div>

              <div className="auth-fcard-passage">
                <span className="auth-fcard-quote-bar" />
                <p className="auth-fcard-quote-text">
                  <span className="auth-fcard-quote-mark">&#x201C;</span>
                  So, how can I ever try to be better? Nobody ever let's me in
                </p>
              </div>

              <div className="auth-fcard-footer">
                <div className="auth-fcard-stats">
                  <span><Heart size={13} /> 18</span>
                  <span><MessageSquare size={13} /> 3</span>
                  <span><Bookmark size={13} /></span>
                </div>
                <MoreHorizontal size={14} className="auth-fcard-more" />
              </div>
            </article>

            {/* Card 2: Movie - Interstellar */}
            <article className="auth-feed-card">
              <div className="auth-fcard-top">
                <div className="auth-fcard-user">
                  <span className="auth-fcard-avatar" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                    JV
                  </span>
                  <div className="auth-fcard-user-names">
                    <span className="auth-fcard-name">Julian Vance</span>
                    <span className="auth-fcard-handle">@julianvance</span>
                  </div>
                </div>
                <div className="auth-fcard-meta">
                  <span className="auth-fcard-time">1mo</span>
                  <Film size={13} className="auth-fcard-type-icon" />
                </div>
              </div>

              <div className="auth-fcard-body">
                <div className="auth-fcard-art">
                  <img
                    src="/covers/interstellar.jpg"
                    alt="Interstellar cover"
                    className="auth-fcard-cover-img"
                    loading="eager"
                  />
                </div>
                <div className="auth-fcard-info">
                  <div className="auth-fcard-stars">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={11} fill="#f5b74c" color="#f5b74c" />
                    ))}
                  </div>
                  <h4 className="auth-fcard-title">Interstellar</h4>
                  <p className="auth-fcard-creator">Christopher Nolan · 2014</p>
                  <div className="auth-fcard-badge-row">
                    <span className="auth-fcard-badge">SCI-FI</span>
                  </div>
                  <p className="auth-fcard-sub">Paramount Pictures</p>
                </div>
              </div>

              <div className="auth-fcard-passage">
                <span className="auth-fcard-quote-bar" />
                <p className="auth-fcard-quote-text">
                  <span className="auth-fcard-quote-mark">&#x201C;</span>
                  We used to look up at the sky and wonder at our place in the stars. Now we just look down and worry about our place in the dirt.
                </p>
              </div>

              <div className="auth-fcard-footer">
                <div className="auth-fcard-stats">
                  <span><Heart size={13} /> 92</span>
                  <span><MessageSquare size={13} /> 17</span>
                  <span><Bookmark size={13} /></span>
                </div>
                <MoreHorizontal size={14} className="auth-fcard-more" />
              </div>
            </article>

            {/* Card 3: Book - The Reptile Room */}
            <article className="auth-feed-card">
              <div className="auth-fcard-top">
                <div className="auth-fcard-user">
                  <span className="auth-fcard-avatar" style={{ background: '#fef3c7', color: '#b45309' }}>
                    ML
                  </span>
                  <div className="auth-fcard-user-names">
                    <span className="auth-fcard-name">Maya Lin</span>
                    <span className="auth-fcard-handle">@mayalin</span>
                  </div>
                </div>
                <div className="auth-fcard-meta">
                  <span className="auth-fcard-time">2mo</span>
                  <BookOpen size={13} className="auth-fcard-type-icon" />
                </div>
              </div>

              <div className="auth-fcard-body">
                <div className="auth-fcard-art auth-fcard-art--book">
                  <img
                    src="/covers/the-reptile-room.jpg"
                    alt="The Reptile Room cover"
                    className="auth-fcard-cover-img"
                    loading="eager"
                  />
                </div>
                <div className="auth-fcard-info">
                  <div className="auth-fcard-stars">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={11} fill="#f5b74c" color="#f5b74c" />
                    ))}
                  </div>
                  <h4 className="auth-fcard-title">The Reptile Room</h4>
                  <p className="auth-fcard-creator">Lemony Snicket</p>
                  <div className="auth-fcard-badge-row">
                    <span className="auth-fcard-badge">JUVENILE FICTION</span>
                  </div>
                  <p className="auth-fcard-sub">A Series of Unfortunate Events #2</p>
                </div>
              </div>

              <div className="auth-fcard-passage">
                <span className="auth-fcard-quote-bar" />
                <p className="auth-fcard-quote-text">
                  <span className="auth-fcard-quote-mark">&#x201C;</span>
                  If you have ever lost someone very important to you, then you know already that everything looks different afterwards.
                </p>
              </div>

              <div className="auth-fcard-footer">
                <div className="auth-fcard-stats">
                  <span><Heart size={13} /> 45</span>
                  <span><MessageSquare size={13} /> 8</span>
                  <span><Bookmark size={13} /></span>
                </div>
                <MoreHorizontal size={14} className="auth-fcard-more" />
              </div>
            </article>
          </div>

          {/* ── Column 2 (Offset / Featuring Noah Kahan) ── */}
          <div className="auth-feed-col auth-feed-col--offset">
            {/* Card 4: NOAH KAHAN - THE GREAT DIVIDE (Highlighted with active red border) */}
            <article className="auth-feed-card auth-feed-card--active">
              <div className="auth-fcard-top">
                <div className="auth-fcard-user">
                  <span className="auth-fcard-avatar" style={{ background: '#fce7f3', color: '#be185d' }}>
                    LM
                  </span>
                  <div className="auth-fcard-user-names">
                    <span className="auth-fcard-name">Liam Montgomery</span>
                    <span className="auth-fcard-handle">@liammontgomery</span>
                  </div>
                </div>
                <div className="auth-fcard-meta">
                  <span className="auth-fcard-time">1mo</span>
                  <Music2 size={13} className="auth-fcard-type-icon" />
                </div>
              </div>

              <div className="auth-fcard-body">
                <div className="auth-fcard-art">
                  <img
                    src="/covers/noah-kahan-great-divide.jpg"
                    alt="Noah Kahan - The Great Divide cover"
                    className="auth-fcard-cover-img"
                    loading="eager"
                  />
                </div>
                <div className="auth-fcard-info">
                  <div className="auth-fcard-stars">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={11} fill="#f5b74c" color="#f5b74c" />
                    ))}
                  </div>
                  <h4 className="auth-fcard-title">A Few Of Your Own</h4>
                  <p className="auth-fcard-creator">Noah Kahan</p>
                  <div className="auth-fcard-badge-row">
                    <span className="auth-fcard-badge">ALTERNATIVE</span>
                  </div>
                  <p className="auth-fcard-sub">The Great Divide: The Last Of The Bugs</p>
                </div>
              </div>

              <div className="auth-fcard-passage">
                <span className="auth-fcard-quote-bar" />
                <p className="auth-fcard-quote-text">
                  <span className="auth-fcard-quote-mark">&#x201C;</span>
                  I was high when I met you, life was something to get through. Pictureframe in your bedroom of the one man that left you.
                </p>
              </div>

              <div className="auth-fcard-footer">
                <div className="auth-fcard-stats">
                  <span><Heart size={13} fill="#f05353" color="#f05353" /> 134</span>
                  <span><MessageSquare size={13} /> 28</span>
                  <span><Bookmark size={13} fill="#c8a26a" color="#c8a26a" /></span>
                </div>
                <MoreHorizontal size={14} className="auth-fcard-more" />
              </div>
            </article>

            {/* Card 5: Olivia Rodrigo - GUTS */}
            <article className="auth-feed-card">
              <div className="auth-fcard-top">
                <div className="auth-fcard-user">
                  <span className="auth-fcard-avatar" style={{ background: '#fae8ff', color: '#a21caf' }}>
                    SR
                  </span>
                  <div className="auth-fcard-user-names">
                    <span className="auth-fcard-name">Sofia Reyes</span>
                    <span className="auth-fcard-handle">@sofiareyes</span>
                  </div>
                </div>
                <div className="auth-fcard-meta">
                  <span className="auth-fcard-time">2w</span>
                  <Music2 size={13} className="auth-fcard-type-icon" />
                </div>
              </div>

              <div className="auth-fcard-body">
                <div className="auth-fcard-art">
                  <img
                    src="/covers/olivia-rodrigo-guts.jpg"
                    alt="Olivia Rodrigo cover"
                    className="auth-fcard-cover-img"
                    loading="eager"
                  />
                </div>
                <div className="auth-fcard-info">
                  <div className="auth-fcard-stars">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={11} fill="#f5b74c" color="#f5b74c" />
                    ))}
                  </div>
                  <h4 className="auth-fcard-title">vampire</h4>
                  <p className="auth-fcard-creator">Olivia Rodrigo</p>
                  <div className="auth-fcard-badge-row">
                    <span className="auth-fcard-badge">POP</span>
                  </div>
                  <p className="auth-fcard-sub">GUTS, Geffen Records</p>
                </div>
              </div>

              <div className="auth-fcard-passage">
                <span className="auth-fcard-quote-bar" />
                <p className="auth-fcard-quote-text">
                  <span className="auth-fcard-quote-mark">&#x201C;</span>
                  How do you lie without flinching? How do you look at the person you broke and sleep peaceful at night?
                </p>
              </div>

              <div className="auth-fcard-footer">
                <div className="auth-fcard-stats">
                  <span><Heart size={13} /> 81</span>
                  <span><MessageSquare size={13} /> 12</span>
                  <span><Bookmark size={13} /></span>
                </div>
                <MoreHorizontal size={14} className="auth-fcard-more" />
              </div>
            </article>

            {/* Card 6: Standalone Quote */}
            <article className="auth-feed-card">
              <div className="auth-fcard-top">
                <div className="auth-fcard-user">
                  <span className="auth-fcard-avatar" style={{ background: '#ede0d4', color: '#7f5539' }}>
                    ER
                  </span>
                  <div className="auth-fcard-user-names">
                    <span className="auth-fcard-name">Elena Rostova</span>
                    <span className="auth-fcard-handle">@elena_r</span>
                  </div>
                </div>
                <div className="auth-fcard-meta">
                  <span className="auth-fcard-time">3w</span>
                  <Quote size={13} className="auth-fcard-type-icon" />
                </div>
              </div>

              <div className="auth-fcard-passage auth-fcard-passage--full">
                <span className="auth-fcard-quote-bar" />
                <p className="auth-fcard-quote-text">
                  <span className="auth-fcard-quote-mark">&#x201C;</span>
                  Dwell on the beauty of life. Watch the stars, and see yourself running with them.
                </p>
              </div>

              <div className="auth-fcard-footer">
                <div className="auth-fcard-stats">
                  <span><Heart size={13} /> 160</span>
                  <span><MessageSquare size={13} /> 22</span>
                  <span><Bookmark size={13} /></span>
                </div>
                <MoreHorizontal size={14} className="auth-fcard-more" />
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}
