import dongsuyeongSchoolLogo from '../../assets/dongsuyeong-school-logo.svg'
import { getSupabaseEnvHelpMessage } from '../../lib/supabase'

function Login({ errorMessage, isSigningIn, hasSupabaseEnv, onGoogleSignIn }) {
  const isDisabled = !hasSupabaseEnv || isSigningIn
  const envHelpMessage = getSupabaseEnvHelpMessage()

  return (
    <section className="auth-shell">
      <section className="auth-card">
        <div className="auth-card__header auth-card__header--center">
          <div className="auth-school-badge" aria-hidden="true">
            <img
              className="auth-school-badge__logo"
              src={dongsuyeongSchoolLogo}
              alt=""
            />
            <div className="auth-school-badge__copy">
              <strong>DONGSUYEONG</strong>
              <span>COUNSELING PORTAL</span>
            </div>
          </div>

          <div className="auth-icon" aria-hidden="true">
            🔒
          </div>
          <h1 className="auth-system-title">동수영중학교 상담 시스템</h1>
          <p className="auth-system-subtitle">선생님 전용 안전한 로그인</p>
          <p className="auth-note">
            {hasSupabaseEnv
              ? 'Google 계정으로 로그인하면 학생 목록과 상담 기록을 안전하게 확인할 수 있습니다.'
              : envHelpMessage}
          </p>
        </div>

        <div className="auth-form">
          {errorMessage ? (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="google-button"
            type="button"
            onClick={onGoogleSignIn}
            disabled={isDisabled}
          >
            <span className="google-button__mark" aria-hidden="true">
              G
            </span>
            <span>{isSigningIn ? 'Google로 연결 중..' : 'Google 계정으로 계속하기'}</span>
          </button>

          <p className="auth-helper">
            승인된 교사 Google 계정으로 로그인하면 상담 기록과 학생 정보가 안전하게
            보호됩니다.
          </p>
        </div>
      </section>
    </section>
  )
}

export default Login
