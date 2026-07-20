export type RecoveryTrigger =
  | 'access_401'
  | 'access_403'
  | 'ws_1008'
  | 'reacquire_failed'

type BinaryCount = 0 | 1

export interface RecoveryBudget {
  metadataRefreshCount: BinaryCount
  accessAttemptCount: BinaryCount
}

export type FreshMetadataDecision =
  | { kind: 'login_required' }
  | { kind: 'password_required'; clearPassword: true }
  | { kind: 'request_access'; password?: string }

export interface AccessPolicyMetadata {
  require_login: boolean
  has_password: boolean
}

export interface FreshMetadataContext {
  hasValidAccount: boolean
  submittedPassword?: string
  recoveryTrigger?: RecoveryTrigger
}

export function newRecoveryBudget(): RecoveryBudget {
  return {
    metadataRefreshCount: 0,
    accessAttemptCount: 0
  }
}

export function consumeMetadataRefresh(budget: RecoveryBudget): RecoveryBudget | null {
  if (budget.metadataRefreshCount === 1) {
    return null
  }

  return {
    ...budget,
    metadataRefreshCount: 1
  }
}

export function consumeAccessAttempt(budget: RecoveryBudget): RecoveryBudget | null {
  if (budget.accessAttemptCount === 1) {
    return null
  }

  return {
    ...budget,
    accessAttemptCount: 1
  }
}

export function gateFromFreshMetadata(
  metadata: AccessPolicyMetadata,
  context: FreshMetadataContext
): FreshMetadataDecision {
  if (metadata.require_login && !context.hasValidAccount) {
    return { kind: 'login_required' }
  }

  if (metadata.has_password) {
    const submittedPassword = context.recoveryTrigger
      ? undefined
      : context.submittedPassword

    if (submittedPassword !== undefined) {
      return { kind: 'request_access', password: submittedPassword }
    }

    return { kind: 'password_required', clearPassword: true }
  }

  return { kind: 'request_access' }
}
