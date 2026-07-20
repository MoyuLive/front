import {
  consumeAccessAttempt,
  consumeMetadataRefresh,
  gateFromFreshMetadata,
  newRecoveryBudget,
  type FreshMetadataDecision,
  type RecoveryTrigger
} from './roomAccessState.js'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertDecisionKind(
  decision: FreshMetadataDecision,
  expected: FreshMetadataDecision['kind']
) {
  assert(decision.kind === expected, `expected ${expected}, got ${decision.kind}`)
}

const publicMetadata = { require_login: false, has_password: false }
const loginMetadata = { require_login: true, has_password: false }
const passwordMetadata = { require_login: false, has_password: true }

const publicDecision = gateFromFreshMetadata(publicMetadata, {
  hasValidAccount: false
})
assertDecisionKind(publicDecision, 'request_access')

const publicToLogin = gateFromFreshMetadata(loginMetadata, {
  hasValidAccount: false
})
assertDecisionKind(publicToLogin, 'login_required')

const publicToPassword = gateFromFreshMetadata(passwordMetadata, {
  hasValidAccount: false
})
assertDecisionKind(publicToPassword, 'password_required')
assert(
  publicToPassword.kind === 'password_required' && publicToPassword.clearPassword,
  'a fresh password gate must clear any stale password'
)

const stalePasswordAfterPolicyChange = gateFromFreshMetadata(publicMetadata, {
  hasValidAccount: true,
  submittedPassword: 'old-room-password'
})
assertDecisionKind(stalePasswordAfterPolicyChange, 'request_access')
assert(
  stalePasswordAfterPolicyChange.kind === 'request_access' &&
    stalePasswordAfterPolicyChange.password === undefined,
  'a latest-public room must not send a stale password'
)

const passwordSubmission = gateFromFreshMetadata(passwordMetadata, {
  hasValidAccount: true,
  submittedPassword: 'fresh-room-password'
})
assert(
  passwordSubmission.kind === 'request_access' &&
    passwordSubmission.password === 'fresh-room-password',
  'a submitted password is used only after fresh metadata still requires it'
)

const wsTrigger: RecoveryTrigger = 'ws_1008'
const wsRecoveryDecision = gateFromFreshMetadata(passwordMetadata, {
  hasValidAccount: true,
  recoveryTrigger: wsTrigger
})
assert(
  wsRecoveryDecision.kind === 'password_required' && wsRecoveryDecision.clearPassword,
  'WS 1008 recovery must return to a cleared password gate'
)

const initialBudget = newRecoveryBudget()
assert(
  initialBudget.metadataRefreshCount === 0 && initialBudget.accessAttemptCount === 0,
  'a user cycle must start with a fresh budget'
)

const afterMetadata = consumeMetadataRefresh(initialBudget)
assert(afterMetadata !== null, 'the first metadata refresh must be allowed')
assert(
  afterMetadata?.metadataRefreshCount === 1,
  'the first metadata refresh must consume the metadata budget'
)
assert(
  afterMetadata ? consumeMetadataRefresh(afterMetadata) === null : false,
  'a cycle must reject a second metadata refresh'
)

const afterAccess = consumeAccessAttempt(afterMetadata ?? initialBudget)
assert(afterAccess !== null, 'the first access request must be allowed')
assert(
  afterAccess?.accessAttemptCount === 1,
  'the first access request must consume the access budget'
)
assert(
  afterAccess ? consumeAccessAttempt(afterAccess) === null : false,
  'a cycle must reject a second access request'
)

const retryBudget = newRecoveryBudget()
assert(
  retryBudget.metadataRefreshCount === 0 && retryBudget.accessAttemptCount === 0,
  'an explicit user retry must receive a new budget'
)
