import { randomBytes, randomInt } from 'node:crypto'
import nodemailer from 'nodemailer'
import { bearerToken, getSupabaseAdmin, readJsonBody } from './supabase-admin.mjs'

const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_LIFETIME_MS = 60 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const DEACTIVATION_REASONS = new Set([
  'taking_a_break',
  'privacy_or_safety',
  'too_distracting',
  'technical_issues',
  'not_finding_value',
  'other',
])
const REACTIVATION_DELAYS_MS = {
  tomorrow: 24 * 60 * 60 * 1000,
  seven_days: 7 * 24 * 60 * 60 * 1000,
  thirty_days: 30 * 24 * 60 * 60 * 1000,
  in_my_own_time: null,
}

// In-memory token & cooldown registries (synchronized & self-expiring)
const verificationTokens = new Map()
const passwordResetTokens = new Map()
const emailCooldowns = new Map()
const passwordResetCooldowns = new Map()

let mailTransport

function requireValue(value, name) {
  if (!value) {
    const error = new Error(`${name} is not configured.`)
    error.statusCode = 503
    throw error
  }
  return value
}

function getMailTransport(env) {
  if (!mailTransport) {
    const port = Number(env.SMTP_PORT || 465)
    mailTransport = nodemailer.createTransport({
      host: requireValue(env.SMTP_HOST || 'smtp.gmail.com', 'SMTP_HOST'),
      port,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
      auth: {
        user: requireValue(env.SMTP_USER, 'SMTP_USER'),
        pass: requireValue(env.SMTP_PASS, 'SMTP_PASS'),
      },
    })
  }
  return mailTransport
}

function cleanAppBaseUrl(env = process.env, request) {
  const requestHost = request?.headers?.['x-forwarded-host'] || request?.headers?.host
  const requestProto = request?.headers?.['x-forwarded-proto'] || (requestHost?.includes('localhost') ? 'http' : 'https')
  const detectedUrl = requestHost ? `${requestProto}://${requestHost}` : null
  const raw = env.APP_BASE_URL || env.RENDER_EXTERNAL_URL || detectedUrl
  if (!raw) {
    const error = new Error('APP_BASE_URL is not configured.')
    error.statusCode = 503
    throw error
  }
  const parsed = new URL(raw)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('APP_BASE_URL must be an HTTP(S) URL.')
  return parsed.origin
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/**
 * Renders the new vector wordmark from `TheCommonplaceRedesign.svg` as inline SVG
 * with sunrise red-and-white theme styling (crisp ink letters with sunrise red pill O's and trailing period).
 */
function renderBrandLogoSvg({ inkColor = '#09090b', accentColor = '#dc3e3e', width = 230 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="52 420 1829 195" width="${width}" style="display:block;margin:0 auto;max-width:100%;height:auto;" aria-hidden="true" focusable="false">
    <g data-name="Layer 1">
      <path fill="${inkColor}" d="M95.496 567.014 L95.496 452.018 L55.178 452.018 L55.178 427.986 L165.606 427.986 L165.606 452.018 L125.287 452.018 L125.287 567.014 Z"/>
      <path fill="${inkColor}" d="M170.176 567.014 L170.176 427.986 L199.141 427.986 L199.141 483.597 L199.141 483.597 C202.23 478.705 206.414 474.779 211.692 471.818 C216.97 468.857 223.149 467.377 230.229 467.377 C238.467 467.377 245.354 469.115 250.89 472.591 C256.425 476.066 260.609 481.119 263.441 487.748 C266.273 494.378 267.689 502.391 267.689 511.789 L267.689 567.014 L238.918 567.014 L238.918 514.492 C238.918 507.283 237.405 501.683 234.38 497.693 C231.355 493.702 226.56 491.707 219.995 491.707 C216.133 491.707 212.593 492.672 209.375 494.603 C206.156 496.534 203.646 499.27 201.844 502.81 C200.042 506.35 199.141 510.566 199.141 515.457 L199.141 567.014 Z"/>
      <path fill="${inkColor}" d="M347.088 562.529 C337.677 566.784 328.526 568.56 319.635 567.857 C310.744 567.155 302.682 564.188 295.449 558.958 C288.216 553.728 282.527 546.528 278.381 537.358 C274.126 527.948 272.325 518.663 272.979 509.503 C273.633 500.343 276.564 492.043 281.773 484.602 C286.982 477.161 294.291 471.312 303.702 467.057 C312.871 462.912 321.794 461.275 330.472 462.146 C339.149 463.018 346.989 465.976 353.992 471.02 C360.995 476.064 366.515 483.049 370.552 491.977 C371.098 493.184 371.681 494.555 372.303 496.09 C372.924 497.626 373.469 499.232 373.937 500.909 L300.281 534.213 L293.162 518.469 L339.672 497.439 C337.14 492.481 333.459 489.241 328.629 487.719 C323.8 486.197 318.851 486.582 313.784 488.873 C309.923 490.619 306.834 493.106 304.515 496.334 C302.197 499.562 300.921 503.408 300.687 507.873 C300.454 512.338 301.591 517.346 304.101 522.895 L306.556 528.325 C308.465 532.547 310.97 535.919 314.072 538.44 C317.174 540.961 320.672 542.431 324.567 542.85 C328.461 543.268 332.52 542.523 336.743 540.614 C340.724 538.814 343.644 536.513 345.501 533.711 C347.359 530.909 348.438 527.915 348.741 524.726 L376.429 512.207 C377.359 518.762 376.823 525.289 374.821 531.789 C372.819 538.288 369.476 544.232 364.791 549.619 C360.107 555.007 354.206 559.31 347.088 562.529 Z"/>
      <path fill="${inkColor}" d="M479.014 569.397 C465.111 569.397 453.128 566.385 443.065 560.36 C433.002 554.336 425.257 545.928 419.828 535.137 C414.399 524.345 411.685 511.932 411.685 497.897 C411.685 483.597 414.399 471.051 419.828 460.26 C425.257 449.469 433.002 440.995 443.065 434.838 C453.128 428.681 465.111 425.602 479.014 425.602 C496.227 425.602 510.295 429.906 521.219 438.512 C532.143 447.119 538.928 459.234 541.577 474.858 L509.004 474.858 C507.415 467.84 504.039 462.379 498.875 458.473 C493.711 454.567 487.025 452.614 478.815 452.614 C471.003 452.614 464.35 454.467 458.855 458.175 C453.36 461.882 449.189 467.079 446.343 473.766 C443.496 480.452 442.072 488.496 442.072 497.897 C442.072 507.033 443.496 514.944 446.343 521.631 C449.189 528.318 453.36 533.481 458.855 537.123 C464.35 540.764 471.003 542.584 478.815 542.584 C487.025 542.584 493.678 540.83 498.776 537.321 C503.874 533.812 507.283 528.748 509.004 522.128 L541.577 522.128 C538.928 536.825 532.143 548.377 521.219 556.785 C510.295 565.193 496.227 569.397 479.014 569.397 Z"/>
      <path fill="${inkColor}" d="M729.877 567.014 L729.877 466.914 L755.895 466.914 L758.477 479.823 L758.477 479.823 C761.655 475.189 765.859 471.482 771.089 468.701 C776.319 465.921 782.377 464.53 789.262 464.53 C794.161 464.53 798.597 465.159 802.569 466.417 C806.541 467.675 810.05 469.529 813.095 471.978 C816.141 474.428 818.656 477.506 820.642 481.214 L820.642 481.214 C824.482 476.05 829.381 471.978 835.34 468.999 C841.298 466.02 847.786 464.53 854.804 464.53 C863.807 464.53 871.255 466.318 877.147 469.893 C883.039 473.468 887.442 478.632 890.355 485.384 C893.268 492.137 894.724 500.346 894.724 510.012 L894.724 567.014 L865.131 567.014 L865.131 512.594 C865.131 505.312 863.708 499.651 860.861 495.613 C858.014 491.574 853.479 489.555 847.256 489.555 C843.284 489.555 839.775 490.548 836.73 492.534 C833.685 494.521 831.334 497.301 829.679 500.876 C828.024 504.451 827.197 508.754 827.197 513.786 L827.197 567.014 L797.604 567.014 L797.604 512.594 C797.604 505.312 796.147 499.651 793.234 495.613 C790.321 491.574 785.621 489.555 779.133 489.555 C775.425 489.555 772.082 490.548 769.103 492.534 C766.124 494.521 763.807 497.301 762.151 500.876 C760.496 504.451 759.669 508.754 759.669 513.786 L759.669 567.014 Z"/>
      <path fill="${inkColor}" d="M904.655 567.014 L904.655 466.914 L930.673 466.914 L933.255 479.823 L933.255 479.823 C936.433 475.189 940.637 471.482 945.867 468.701 C951.097 465.921 957.155 464.53 964.04 464.53 C968.939 464.53 973.374 465.159 977.347 466.417 C981.319 467.675 984.828 469.529 987.873 471.978 C990.918 474.428 993.434 477.506 995.42 481.214 L995.42 481.214 C999.26 476.05 1004.159 471.978 1010.118 468.999 C1016.076 466.02 1022.564 464.53 1029.581 464.53 C1038.585 464.53 1046.033 466.318 1051.925 469.893 C1057.817 473.468 1062.22 478.632 1065.133 485.384 C1068.046 492.137 1069.502 500.346 1069.502 510.012 L1069.502 567.014 L1039.909 567.014 L1039.909 512.594 C1039.909 505.312 1038.486 499.651 1035.639 495.613 C1032.792 491.574 1028.257 489.555 1022.034 489.555 C1018.062 489.555 1014.553 490.548 1011.508 492.534 C1008.462 494.521 1006.112 497.301 1004.457 500.876 C1002.802 504.451 1001.974 508.754 1001.974 513.786 L1001.974 567.014 L972.381 567.014 L972.381 512.594 C972.381 505.312 970.925 499.651 968.012 495.613 C965.099 491.574 960.399 489.555 953.911 489.555 C950.203 489.555 946.86 490.548 943.881 492.534 C940.902 494.521 938.584 497.301 936.929 500.876 C935.274 504.451 934.447 508.754 934.447 513.786 L934.447 567.014 Z"/>
      <path fill="${inkColor}" d="M1259.45 567.014 L1259.45 466.914 L1285.468 466.914 L1287.852 483.001 L1287.852 483.001 C1290.897 477.44 1295.2 472.971 1300.761 469.595 C1306.322 466.218 1313.075 464.53 1321.02 464.53 C1329.361 464.53 1336.379 466.318 1342.072 469.893 C1347.766 473.468 1352.102 478.599 1355.081 485.285 C1358.061 491.972 1359.55 500.148 1359.55 509.814 L1359.55 567.014 L1329.957 567.014 L1329.957 512.594 C1329.957 505.312 1328.401 499.651 1325.29 495.613 C1322.178 491.574 1317.246 489.555 1310.493 489.555 C1306.521 489.555 1302.913 490.515 1299.669 492.435 C1296.425 494.355 1293.876 497.102 1292.022 500.677 C1290.169 504.253 1289.242 508.556 1289.242 513.587 L1289.242 567.014 Z"/>
      <path fill="${inkColor}" d="M1369.481 610.708 L1369.481 466.914 L1395.896 466.914 L1399.272 480.022 L1399.272 480.022 C1401.391 477.241 1403.841 474.659 1406.621 472.276 C1409.402 469.893 1412.745 468.006 1416.651 466.616 C1420.557 465.225 1425.158 464.53 1430.454 464.53 C1439.723 464.53 1447.899 466.847 1454.983 471.482 C1462.067 476.116 1467.727 482.372 1471.964 490.25 C1476.201 498.129 1478.32 507.099 1478.32 517.162 C1478.32 527.225 1476.168 536.196 1471.865 544.074 C1467.562 551.952 1461.835 558.142 1454.685 562.644 C1447.535 567.146 1439.524 569.397 1430.653 569.397 C1423.503 569.397 1417.346 568.139 1412.182 565.623 C1407.018 563.108 1402.715 559.599 1399.272 555.097 L1399.272 610.708 Z M1423.106 543.379 C1427.872 543.379 1432.143 542.287 1435.916 540.102 C1439.69 537.917 1442.636 534.839 1444.754 530.866 C1446.873 526.894 1447.932 522.326 1447.932 517.162 C1447.932 511.998 1446.873 507.43 1444.754 503.458 C1442.636 499.486 1439.69 496.341 1435.916 494.024 C1432.143 491.707 1427.872 490.548 1423.106 490.548 C1418.207 490.548 1413.87 491.707 1410.097 494.024 C1406.323 496.341 1403.377 499.486 1401.259 503.458 C1399.14 507.43 1398.081 511.932 1398.081 516.964 C1398.081 522.128 1399.14 526.729 1401.259 530.767 C1403.377 534.806 1406.323 537.917 1410.097 540.102 C1413.87 542.287 1418.207 543.379 1423.106 543.379 Z"/>
      <path fill="${inkColor}" d="M1486.264 567.014 L1486.264 424.014 L1516.056 424.014 L1516.056 567.014 Z"/>
      <path fill="${inkColor}" d="M1561.141 569.397 C1552.799 569.397 1545.881 568.073 1540.386 565.425 C1534.891 562.777 1530.852 559.169 1528.27 554.6 C1525.689 550.032 1524.398 544.968 1524.398 539.407 C1524.398 533.448 1525.887 528.185 1528.866 523.617 C1531.845 519.049 1536.513 515.408 1542.868 512.693 C1549.224 509.979 1557.235 508.622 1566.9 508.622 L1591.131 508.622 C1591.131 504.12 1590.568 500.413 1589.443 497.5 C1588.317 494.587 1586.497 492.402 1583.981 490.946 C1581.465 489.489 1578.023 488.761 1573.653 488.761 C1569.019 488.761 1565.113 489.688 1561.935 491.541 C1558.757 493.395 1556.771 496.308 1555.977 500.28 L1527.377 500.28 C1528.039 493.13 1530.389 486.907 1534.427 481.611 C1538.466 476.315 1543.861 472.144 1550.614 469.098 C1557.367 466.053 1565.113 464.53 1573.852 464.53 C1583.385 464.53 1591.661 466.086 1598.678 469.198 C1605.696 472.309 1611.158 476.844 1615.064 482.802 C1618.97 488.761 1620.923 496.176 1620.923 505.047 L1620.923 567.014 L1596.096 567.014 L1592.521 552.515 L1592.521 552.515 C1591.065 555.031 1589.343 557.315 1587.357 559.367 C1585.371 561.419 1583.054 563.207 1580.406 564.73 C1577.758 566.252 1574.845 567.411 1571.667 568.205 C1568.489 569 1564.98 569.397 1561.141 569.397 Z M1568.489 546.755 C1571.667 546.755 1574.448 546.226 1576.831 545.166 C1579.214 544.107 1581.267 542.651 1582.988 540.797 C1584.709 538.943 1586.133 536.792 1587.258 534.342 C1588.383 531.893 1589.211 529.211 1589.741 526.298 L1589.741 526.1 L1570.475 526.1 C1567.165 526.1 1564.418 526.53 1562.233 527.391 C1560.048 528.251 1558.426 529.476 1557.367 531.065 C1556.308 532.654 1555.778 534.508 1555.778 536.626 C1555.778 538.877 1556.341 540.764 1557.466 542.287 C1558.592 543.809 1560.114 544.935 1562.034 545.663 C1563.954 546.391 1566.106 546.755 1568.489 546.755 Z"/>
      <path fill="${inkColor}" d="M1680.307 569.397 C1669.98 569.397 1660.877 567.146 1652.998 562.644 C1645.12 558.142 1638.963 551.985 1634.527 544.173 C1630.092 536.361 1627.874 527.424 1627.874 517.361 C1627.874 507.033 1630.092 497.93 1634.527 490.052 C1638.963 482.174 1645.12 475.95 1652.998 471.382 C1660.877 466.814 1669.98 464.53 1680.307 464.53 C1693.416 464.53 1704.439 467.973 1713.376 474.858 C1722.314 481.743 1727.974 491.343 1730.357 503.657 L1698.778 503.657 C1697.587 499.42 1695.336 496.109 1692.025 493.726 C1688.715 491.343 1684.743 490.151 1680.109 490.151 C1675.739 490.151 1671.933 491.243 1668.689 493.428 C1665.445 495.613 1662.896 498.724 1661.042 502.763 C1659.188 506.801 1658.261 511.535 1658.261 516.964 C1658.261 521.068 1658.791 524.776 1659.85 528.086 C1660.91 531.396 1662.399 534.243 1664.319 536.626 C1666.239 539.009 1668.523 540.83 1671.171 542.088 C1673.819 543.346 1676.799 543.975 1680.109 543.975 C1683.287 543.975 1686.1 543.445 1688.55 542.386 C1690.999 541.327 1693.118 539.804 1694.905 537.818 C1696.693 535.832 1697.984 533.382 1698.778 530.469 L1730.357 530.469 C1727.974 542.386 1722.281 551.853 1713.277 558.871 C1704.273 565.888 1693.283 569.397 1680.307 569.397 Z"/>
      <path fill="${inkColor}" d="M1809.279 562.372 C1799.868 566.627 1790.717 568.403 1781.826 567.701 C1772.935 566.998 1764.873 564.032 1757.64 558.801 C1750.407 553.571 1744.718 546.371 1740.572 537.202 C1736.317 527.791 1734.516 518.506 1735.17 509.346 C1735.824 500.186 1738.755 491.886 1743.964 484.445 C1749.173 477.004 1756.483 471.156 1765.894 466.901 C1775.063 462.755 1783.986 461.118 1792.663 461.99 C1801.34 462.862 1809.18 465.82 1816.184 470.863 C1823.187 475.907 1828.707 482.893 1832.743 491.821 C1833.289 493.027 1833.873 494.398 1834.494 495.934 C1835.116 497.469 1835.66 499.075 1836.128 500.753 L1762.473 534.056 L1755.354 518.312 L1801.864 497.282 C1799.331 492.324 1795.65 489.084 1790.821 487.562 C1785.991 486.041 1781.043 486.425 1775.976 488.716 C1772.115 490.462 1769.025 492.949 1766.707 496.177 C1764.388 499.405 1763.112 503.251 1762.878 507.716 C1762.645 512.181 1763.783 517.189 1766.292 522.739 L1768.747 528.168 C1770.656 532.39 1773.162 535.762 1776.263 538.283 C1779.365 540.804 1782.863 542.274 1786.758 542.693 C1790.653 543.112 1794.711 542.366 1798.934 540.457 C1802.915 538.657 1805.835 536.356 1807.692 533.554 C1809.55 530.753 1810.63 527.758 1810.932 524.57 L1838.621 512.05 C1839.55 518.605 1839.014 525.132 1837.012 531.632 C1835.01 538.132 1831.667 544.075 1826.983 549.463 C1822.298 554.851 1816.397 559.154 1809.279 562.372 Z"/>
      <path fill="${accentColor}" d="M1859.057 568.007 C1853.629 568.007 1849.226 566.385 1845.85 563.141 C1842.473 559.897 1840.785 555.958 1840.785 551.323 C1840.785 546.557 1842.473 542.551 1845.85 539.307 C1849.226 536.063 1853.629 534.441 1859.057 534.441 C1864.354 534.441 1868.657 536.063 1871.967 539.307 C1875.277 542.551 1876.932 546.557 1876.932 551.323 C1876.932 555.958 1875.277 559.897 1871.967 563.141 C1868.657 566.385 1864.354 568.007 1859.057 568.007 Z"/>
      <path fill="none" stroke="${accentColor}" stroke-width="27" stroke-miterlimit="10" d="M602.082 473.853 L669.224 473.853 C690.59 473.853 707.91 491.173 707.91 512.539 L707.91 512.539 C707.91 533.904 690.59 551.224 669.224 551.224 L602.082 551.224 C580.717 551.224 563.396 533.904 563.396 512.539 L563.396 512.539 C563.396 491.173 580.717 473.853 602.082 473.853 Z"/>
      <path fill="none" stroke="${accentColor}" stroke-width="27" stroke-miterlimit="10" d="M1130.905 478.278 L1198.047 478.278 C1219.413 478.278 1236.733 495.598 1236.733 516.964 L1236.733 516.964 C1236.733 538.329 1219.413 555.649 1198.047 555.649 L1130.905 555.649 C1109.54 555.649 1092.22 538.329 1092.22 516.964 L1092.22 516.964 C1092.22 495.598 1109.54 478.278 1130.905 478.278 Z"/>
    </g>
  </svg>`
}

function renderVerificationEmail({ email, verificationUrl }) {
  const safeEmail = escapeHtml(email)
  const safeVerificationUrl = escapeHtml(verificationUrl)
  const logoSvg = renderBrandLogoSvg({ inkColor: '#09090b', accentColor: '#dc3e3e', width: 310 })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet">
    <title>Verify your email</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;color:#09090b;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      One last step: verify your email to enter The Commonplace.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:0 12px 28px;">
                <div style="padding:10px 0 6px;">
                  ${logoSvg}
                  <div style="font-size:0;line-height:0;height:0;overflow:hidden;opacity:0;color:transparent;">The Commonplace.</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #e4e4e7;border-radius:20px;background-color:#ffffff;padding:46px 46px 40px;box-shadow:0 10px 30px -10px rgba(0,0,0,0.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <div style="margin:0;color:#09090b;font-family:'Quicksand','DM Sans',sans-serif;font-weight:700;font-size:28px;line-height:36px;letter-spacing:-0.3px;">
                        Verify your email address.
                      </div>
                      <div style="margin:16px auto 0;max-width:440px;color:#52525b;font-family:'DM Sans',sans-serif;font-size:15px;line-height:24px;">
                        Finish creating your account for <strong style="color:#dc3e3e;font-weight:600;">${safeEmail}</strong>.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:32px 0 28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                          <td align="center" bgcolor="#dc3e3e" style="border-radius:10px;background-color:#dc3e3e;">
                            <a href="${safeVerificationUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:'Quicksand','DM Sans',sans-serif;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">Verify email address</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="border-top:1px solid #f4f4f5;padding-top:24px;color:#71717a;font-family:'DM Sans',sans-serif;font-size:12px;line-height:19px;">
                      This private, one-time link expires in 24 hours.<br>
                      If you did not sign up for The Commonplace, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:26px 20px 0;color:#a1a1aa;font-family:'DM Sans',sans-serif;font-size:11px;line-height:18px;">
                Sent by The Commonplace &nbsp;&bull;&nbsp; A home for the things that stay with you.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function renderPasswordResetEmail({ email, resetUrl }) {
  const safeEmail = escapeHtml(email)
  const safeResetUrl = escapeHtml(resetUrl)
  const logoSvg = renderBrandLogoSvg({ inkColor: '#09090b', accentColor: '#dc3e3e', width: 310 })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet">
    <title>Reset your password</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;color:#09090b;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Use this private link to reset your password for The Commonplace.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:0 12px 28px;">
                <div style="padding:10px 0 6px;">
                  ${logoSvg}
                  <div style="font-size:0;line-height:0;height:0;overflow:hidden;opacity:0;color:transparent;">The Commonplace.</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #e4e4e7;border-radius:20px;background-color:#ffffff;padding:46px 46px 40px;box-shadow:0 10px 30px -10px rgba(0,0,0,0.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <div style="margin:0;color:#09090b;font-family:'Quicksand','DM Sans',sans-serif;font-weight:700;font-size:28px;line-height:36px;letter-spacing:-0.3px;">
                        Reset your password.
                      </div>
                      <div style="margin:16px auto 0;max-width:440px;color:#52525b;font-family:'DM Sans',sans-serif;font-size:15px;line-height:24px;">
                        We received a password reset request for <strong style="color:#dc3e3e;font-weight:600;">${safeEmail}</strong>.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:32px 0 28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                          <td align="center" bgcolor="#dc3e3e" style="border-radius:10px;background-color:#dc3e3e;">
                            <a href="${safeResetUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:'Quicksand','DM Sans',sans-serif;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">Reset my password</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="border-top:1px solid #f4f4f5;padding-top:24px;color:#71717a;font-family:'DM Sans',sans-serif;font-size:12px;line-height:19px;">
                      This private, one-time link expires in 1 hour.<br>
                      If you did not request a password reset, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:26px 20px 0;color:#a1a1aa;font-family:'DM Sans',sans-serif;font-size:11px;line-height:18px;">
                Sent by The Commonplace &nbsp;&bull;&nbsp; A home for the things that stay with you.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function validActionToken(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(token)
}

function normalizeHandle(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function isValidHandle(handle) {
  return /^[a-z0-9_]{3,20}$/.test(handle)
}

function randomizedHandleCandidates(handle, count = 12) {
  const base = normalizeHandle(handle).replace(/[^a-z0-9_]/g, '').slice(0, 14) || 'reader'
  const candidates = new Set()
  while (candidates.size < count) {
    candidates.add(`${base}_${randomInt(100, 10000)}`.slice(0, 20))
  }
  return [...candidates]
}

async function findUserByIdentifier(identifier, supabase) {
  const normalized = String(identifier || '').trim().toLowerCase()
  if (!normalized || normalized.length > 254) return null

  if (normalized.startsWith('@') || !normalized.includes('@')) {
    const handle = normalized.replace(/^@/, '')
    if (!isValidHandle(handle)) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, handle')
      .ilike('handle', handle)
      .maybeSingle()
    if (!profile?.id) return null

    const { data: userData, error } = await supabase.auth.admin.getUserById(profile.id)
    if (error || !userData?.user) return null
    return {
      uid: userData.user.id,
      email: userData.user.email,
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
  // In Supabase Auth, list users matching email or generateLink
  const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 })
  const matched = (userList?.users || []).find((u) => u.email?.toLowerCase() === normalized)
  if (!matched) return null
  return {
    uid: matched.id,
    email: matched.email,
  }
}

async function sendVerificationLink(request, env) {
  const idToken = bearerToken(request)
  if (!idToken) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const { data: authData, error: authError } = await supabase.auth.getUser(idToken)
  if (authError || !authData?.user) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const user = authData.user
  if (user.email_confirmed_at) return { alreadyVerified: true }
  const email = user.email
  if (!email) {
    const error = new Error('This account does not have an email address.')
    error.statusCode = 400
    throw error
  }

  const lastSentAt = emailCooldowns.get(user.id) || 0
  const remainingMs = RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)
  if (remainingMs > 0) {
    const error = new Error(`Please wait ${Math.ceil(remainingMs / 1000)} seconds before resending.`)
    error.statusCode = 429
    error.retryAfter = Math.ceil(remainingMs / 1000)
    throw error
  }

  const token = randomBytes(16).toString('base64url')
  const expiresAt = Date.now() + LINK_LIFETIME_MS
  verificationTokens.set(token, { uid: user.id, email, expiresAt })
  emailCooldowns.set(user.id, Date.now())

  const cleanLink = `${cleanAppBaseUrl(env, request)}/v/${token}`
  const sender = env.EMAIL_FROM || `The Commonplace <${requireValue(env.SMTP_USER, 'SMTP_USER')}>`
  try {
    await getMailTransport(env).sendMail({
      from: sender,
      to: email,
      subject: 'Verify your email — The Commonplace',
      text: `Your commonplace awaits.\n\nVerify ${email} to finish creating your account:\n${cleanLink}\n\nThis private, one-time link expires in 24 hours. If you did not create this account, you can safely ignore this email.`,
      html: renderVerificationEmail({ email, verificationUrl: cleanLink }),
    })
  } catch (error) {
    verificationTokens.delete(token)
    throw error
  }

  return { sent: true, retryAfter: 60 }
}

async function redeemVerificationLink(request, env) {
  const { token } = await readJsonBody(request)
  if (!validActionToken(token)) {
    const error = new Error('Invalid verification link.')
    error.statusCode = 400
    throw error
  }

  const record = verificationTokens.get(token)
  if (!record || record.expiresAt <= Date.now()) {
    const error = new Error('This verification link is invalid or expired.')
    error.statusCode = 400
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  await supabase.auth.admin.updateUserById(record.uid, { email_confirm: true })
  verificationTokens.delete(token)
  return { verified: true }
}

async function findEmailByHandle(request, env) {
  const handle = new URL(request.url || '/', 'http://localhost').searchParams.get('handle') || ''
  const normalized = normalizeHandle(handle)
  if (!isValidHandle(normalized)) {
    const error = new Error('Invalid username.')
    error.statusCode = 400
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const user = await findUserByIdentifier(`@${normalized}`, supabase)
  if (!user?.email) {
    const error = new Error('Account not found.')
    error.statusCode = 404
    throw error
  }
  return { email: user.email }
}

async function checkHandleAvailability(request, env) {
  const handle = new URL(request.url || '/', 'http://localhost').searchParams.get('handle') || ''
  const normalized = normalizeHandle(handle)
  if (!isValidHandle(normalized)) {
    const error = new Error('Usernames must be 3–20 characters using only letters, numbers, or underscores.')
    error.statusCode = 400
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const { data: existing } = await supabase
    .from('profiles')
    .select('handle')
    .ilike('handle', normalized)
    .maybeSingle()

  if (!existing) return { handle: normalized, available: true, suggestions: [] }

  const candidates = randomizedHandleCandidates(normalized)
  const { data: takenProfiles } = await supabase
    .from('profiles')
    .select('handle')
    .in('handle', candidates)

  const takenSet = new Set((takenProfiles || []).map((p) => p.handle.toLowerCase()))
  const suggestions = candidates.filter((candidate) => !takenSet.has(candidate.toLowerCase())).slice(0, 3)

  return { handle: normalized, available: false, suggestions }
}

function validateDeactivationRequest(data, now = Date.now()) {
  const reason = String(data?.reason || '').trim()
  const returnPlan = String(data?.returnPlan || '').trim()
  const feedback = typeof data?.feedback === 'string' ? data.feedback.trim() : ''

  if (!DEACTIVATION_REASONS.has(reason)) {
    const error = new Error('Choose a reason for deactivating your account.')
    error.statusCode = 400
    throw error
  }
  if (!Object.hasOwn(REACTIVATION_DELAYS_MS, returnPlan)) {
    const error = new Error('Choose when you plan to return.')
    error.statusCode = 400
    throw error
  }
  const delay = REACTIVATION_DELAYS_MS[returnPlan]
  return {
    reason,
    returnPlan,
    feedback,
    safetyConcern: data?.safetyConcern === true,
    reactivatesAt: typeof delay === 'number' ? new Date(now + delay) : null,
  }
}

async function deactivateAuthenticatedAccount(request, env) {
  const idToken = bearerToken(request)
  if (!idToken) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }
  const requestData = validateDeactivationRequest(await readJsonBody(request))
  const supabase = getSupabaseAdmin(env)
  const { data: authData, error: authError } = await supabase.auth.getUser(idToken)
  if (authError || !authData?.user) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const uid = authData.user.id
  await supabase
    .from('profiles')
    .update({
      account_status: 'deactivated',
      reactivates_at: requestData.reactivatesAt?.toISOString() || null,
      deactivation_reason: requestData.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', uid)

  return {
    deactivated: true,
    reactivatesAt: requestData.reactivatesAt?.toISOString() || null,
  }
}

async function deleteAuthenticatedAccount(request, env) {
  const idToken = bearerToken(request)
  if (!idToken) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const { data: authData, error: authError } = await supabase.auth.getUser(idToken)
  if (authError || !authData?.user) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const uid = authData.user.id
  // Database cascades all profile, entries, and follow relations automatically on user delete
  await supabase.auth.admin.deleteUser(uid)
  return { deleted: true }
}

async function sendPasswordResetLink(request, env) {
  const { identifier } = await readJsonBody(request)
  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 254) {
    const error = new Error('Enter a valid email or username.')
    error.statusCode = 400
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const user = await findUserByIdentifier(identifier, supabase)
  if (!user?.email) return { sent: true }

  const lastSentAt = passwordResetCooldowns.get(user.uid) || 0
  if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) return { sent: true }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + PASSWORD_RESET_LIFETIME_MS
  passwordResetTokens.set(token, {
    uid: user.uid,
    email: user.email,
    expiresAt,
  })
  passwordResetCooldowns.set(user.uid, Date.now())

  const resetUrl = `${cleanAppBaseUrl(env, request)}/reset-password/${token}`
  const sender = env.EMAIL_FROM || `The Commonplace <${requireValue(env.SMTP_USER, 'SMTP_USER')}>`
  try {
    await getMailTransport(env).sendMail({
      from: sender,
      to: user.email,
      subject: 'Reset your password — The Commonplace',
      text: `Reset your password for The Commonplace:\n${resetUrl}\n\nThis private, one-time link expires in 1 hour. If you did not request this reset, you can safely ignore this email.`,
      html: renderPasswordResetEmail({ email: user.email, resetUrl }),
    })
  } catch (error) {
    passwordResetTokens.delete(token)
    passwordResetCooldowns.delete(user.uid)
    throw error
  }

  return { sent: true }
}

async function validatePasswordResetLink(request, _env) {
  const { token } = await readJsonBody(request)
  if (!validActionToken(token)) return { valid: false }
  const record = passwordResetTokens.get(token)
  const valid = Boolean(record && record.expiresAt > Date.now())
  return { valid }
}

async function redeemPasswordResetLink(request, env) {
  const { token, newPassword } = await readJsonBody(request)
  if (!validActionToken(token)) {
    const error = new Error('This password reset link is invalid or expired.')
    error.statusCode = 400
    throw error
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    const error = new Error('Your new password must be between 8 and 128 characters.')
    error.statusCode = 400
    throw error
  }

  const record = passwordResetTokens.get(token)
  if (!record || record.expiresAt <= Date.now()) {
    const error = new Error('This password reset link is invalid or expired.')
    error.statusCode = 400
    throw error
  }

  passwordResetTokens.delete(token)
  const supabase = getSupabaseAdmin(env)
  await supabase.auth.admin.updateUserById(record.uid, { password: newPassword })
  return { reset: true }
}

export async function handleAuthApiRequest(request, env = process.env) {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  if (request.method === 'POST' && pathname === '/api/auth/account/deactivate') {
    return deactivateAuthenticatedAccount(request, env)
  }
  if (request.method === 'DELETE' && pathname === '/api/auth/account') {
    return deleteAuthenticatedAccount(request, env)
  }
  if (request.method === 'GET' && pathname === '/api/auth/handle-availability') {
    return checkHandleAvailability(request, env)
  }
  if (request.method === 'GET' && pathname === '/api/auth/user-by-handle') {
    return findEmailByHandle(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/verification-links') {
    return sendVerificationLink(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/verification-links/redeem') {
    return redeemVerificationLink(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/password-reset-links') {
    return sendPasswordResetLink(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/password-reset-links/validate') {
    return validatePasswordResetLink(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/password-reset-links/redeem') {
    return redeemPasswordResetLink(request, env)
  }
  return null
}

export const authLinkInternals = {
  cleanAppBaseUrl,
  escapeHtml,
  renderVerificationEmail,
  renderPasswordResetEmail,
  validActionToken,
  normalizeHandle,
  isValidHandle,
  randomizedHandleCandidates,
  validateDeactivationRequest,
}
