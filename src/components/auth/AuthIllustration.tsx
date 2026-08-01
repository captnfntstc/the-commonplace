import React from 'react'

export const AuthIllustration: React.FC = () => {
  return (
    <div className="auth-illustration-wrapper" aria-hidden="true">
      <svg
        viewBox="0 0 320 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="auth-illustration-svg"
      >
        {/* ── Candle glow (ambient circle behind everything) ── */}
        <ellipse cx="160" cy="340" rx="90" ry="18" fill="rgba(205,167,116,0.06)" />

        {/* ── Stack of books ── */}
        {/* Book 5 (bottom, widest) */}
        <rect x="60" y="288" width="200" height="22" rx="3" fill="rgba(205,167,116,0.10)" stroke="rgba(205,167,116,0.22)" strokeWidth="1" />
        <rect x="60" y="288" width="14" height="22" rx="2" fill="rgba(205,167,116,0.18)" stroke="rgba(205,167,116,0.28)" strokeWidth="1" />
        <line x1="82" y1="295" x2="82" y2="303" stroke="rgba(205,167,116,0.18)" strokeWidth="1" />

        {/* Book 4 */}
        <rect x="70" y="264" width="184" height="24" rx="3" fill="rgba(205,167,116,0.08)" stroke="rgba(205,167,116,0.20)" strokeWidth="1" />
        <rect x="70" y="264" width="12" height="24" rx="2" fill="rgba(205,167,116,0.15)" stroke="rgba(205,167,116,0.24)" strokeWidth="1" />
        <line x1="90" y1="272" x2="90" y2="280" stroke="rgba(205,167,116,0.16)" strokeWidth="1" />

        {/* Book 3 */}
        <rect x="78" y="237" width="168" height="27" rx="3" fill="rgba(205,167,116,0.12)" stroke="rgba(205,167,116,0.26)" strokeWidth="1" />
        <rect x="78" y="237" width="16" height="27" rx="2" fill="rgba(205,167,116,0.22)" stroke="rgba(205,167,116,0.32)" strokeWidth="1" />
        {/* small title lines */}
        <line x1="104" y1="246" x2="220" y2="246" stroke="rgba(205,167,116,0.14)" strokeWidth="1" />
        <line x1="104" y1="252" x2="190" y2="252" stroke="rgba(205,167,116,0.10)" strokeWidth="1" />

        {/* Book 2 */}
        <rect x="84" y="208" width="152" height="29" rx="3" fill="rgba(205,167,116,0.09)" stroke="rgba(205,167,116,0.22)" strokeWidth="1" />
        <rect x="84" y="208" width="14" height="29" rx="2" fill="rgba(205,167,116,0.18)" stroke="rgba(205,167,116,0.28)" strokeWidth="1" />
        <line x1="108" y1="219" x2="218" y2="219" stroke="rgba(205,167,116,0.12)" strokeWidth="1" />
        <line x1="108" y1="225" x2="196" y2="225" stroke="rgba(205,167,116,0.09)" strokeWidth="1" />

        {/* Book 1 (top, smaller) */}
        <rect x="94" y="184" width="132" height="24" rx="3" fill="rgba(205,167,116,0.13)" stroke="rgba(205,167,116,0.28)" strokeWidth="1" />
        <rect x="94" y="184" width="12" height="24" rx="2" fill="rgba(205,167,116,0.24)" stroke="rgba(205,167,116,0.36)" strokeWidth="1" />
        <line x1="116" y1="192" x2="208" y2="192" stroke="rgba(205,167,116,0.16)" strokeWidth="1" />
        <line x1="116" y1="198" x2="188" y2="198" stroke="rgba(205,167,116,0.12)" strokeWidth="1" />

        {/* ── Bookmark ribbon ── */}
        <path
          d="M202 184 L202 155 L215 155 L215 184 L208.5 178 Z"
          fill="rgba(205,167,116,0.14)"
          stroke="rgba(205,167,116,0.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        />

        {/* ── Open notebook ── */}
        <path
          d="M90 155 Q90 142 104 142 L160 142 L160 180 L90 180 Z"
          fill="rgba(205,167,116,0.07)"
          stroke="rgba(205,167,116,0.20)"
          strokeWidth="1"
        />
        <path
          d="M160 142 L216 142 Q230 142 230 155 L230 180 L160 180 Z"
          fill="rgba(205,167,116,0.10)"
          stroke="rgba(205,167,116,0.22)"
          strokeWidth="1"
        />
        {/* Notebook spine */}
        <line x1="160" y1="142" x2="160" y2="180" stroke="rgba(205,167,116,0.28)" strokeWidth="1.5" />
        {/* Ruled lines left page */}
        <line x1="104" y1="151" x2="154" y2="151" stroke="rgba(205,167,116,0.12)" strokeWidth="0.8" />
        <line x1="104" y1="158" x2="154" y2="158" stroke="rgba(205,167,116,0.10)" strokeWidth="0.8" />
        <line x1="104" y1="165" x2="154" y2="165" stroke="rgba(205,167,116,0.12)" strokeWidth="0.8" />
        <line x1="104" y1="172" x2="140" y2="172" stroke="rgba(205,167,116,0.08)" strokeWidth="0.8" />
        {/* Ruled lines right page */}
        <line x1="168" y1="151" x2="222" y2="151" stroke="rgba(205,167,116,0.12)" strokeWidth="0.8" />
        <line x1="168" y1="158" x2="222" y2="158" stroke="rgba(205,167,116,0.10)" strokeWidth="0.8" />
        <line x1="168" y1="165" x2="210" y2="165" stroke="rgba(205,167,116,0.12)" strokeWidth="0.8" />

        {/* ── Fountain pen resting diagonally ── */}
        <g transform="rotate(-28, 160, 130)">
          {/* Barrel */}
          <rect x="114" y="94" width="92" height="9" rx="4.5" fill="rgba(205,167,116,0.16)" stroke="rgba(205,167,116,0.32)" strokeWidth="1" />
          {/* Cap join ring */}
          <rect x="114" y="95" width="14" height="7" rx="3.5" fill="rgba(205,167,116,0.26)" stroke="rgba(205,167,116,0.38)" strokeWidth="1" />
          {/* Nib */}
          <path d="M206 98.5 L218 96 L218 101 Z" fill="rgba(205,167,116,0.32)" stroke="rgba(205,167,116,0.42)" strokeWidth="0.8" />
          {/* Clip */}
          <rect x="118" y="93" width="2" height="11" rx="1" fill="rgba(205,167,116,0.28)" />
        </g>

        {/* ── Small pressed leaf (decorative) ── */}
        <ellipse cx="245" cy="200" rx="12" ry="6" transform="rotate(-40, 245, 200)" fill="rgba(205,167,116,0.10)" stroke="rgba(205,167,116,0.20)" strokeWidth="0.8" />
        <line x1="238" y1="204" x2="252" y2="196" stroke="rgba(205,167,116,0.18)" strokeWidth="0.7" />
        <line x1="240" y1="202" x2="244" y2="198" stroke="rgba(205,167,116,0.12)" strokeWidth="0.6" />
        <line x1="248" y1="199" x2="250" y2="195" stroke="rgba(205,167,116,0.12)" strokeWidth="0.6" />

        {/* ── Small paperclip ── */}
        <path
          d="M75 165 Q68 165 68 172 Q68 179 75 179 L82 179 L82 168 Q82 163 77 163 Q72 163 72 168 L72 176"
          stroke="rgba(205,167,116,0.22)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* ── Candle ── */}
        <rect x="147" y="98" width="26" height="44" rx="3" fill="rgba(205,167,116,0.10)" stroke="rgba(205,167,116,0.22)" strokeWidth="1" />
        {/* Wax drip */}
        <path d="M147 112 Q140 115 141 122 L147 122 Z" fill="rgba(205,167,116,0.08)" stroke="rgba(205,167,116,0.16)" strokeWidth="0.8" />
        {/* Wick */}
        <line x1="160" y1="98" x2="160" y2="88" stroke="rgba(205,167,116,0.30)" strokeWidth="1.2" strokeLinecap="round" />
        {/* Flame outer */}
        <path
          d="M160 88 Q156 80 158 72 Q160 64 162 72 Q164 80 160 88 Z"
          fill="rgba(205,167,116,0.18)"
          stroke="rgba(205,167,116,0.32)"
          strokeWidth="0.8"
        />
        {/* Flame inner glow */}
        <path
          d="M160 85 Q158 80 159 75 Q160 70 161 75 Q162 80 160 85 Z"
          fill="rgba(205,167,116,0.28)"
        />
        {/* Candle holder saucer */}
        <ellipse cx="160" cy="142" rx="20" ry="5" fill="rgba(205,167,116,0.14)" stroke="rgba(205,167,116,0.26)" strokeWidth="1" />
        <rect x="148" y="138" width="24" height="6" rx="2" fill="rgba(205,167,116,0.12)" stroke="rgba(205,167,116,0.22)" strokeWidth="1" />
      </svg>
    </div>
  )
}
