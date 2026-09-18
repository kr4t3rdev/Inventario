/**
 * @description Evalúa si un tenant puede participar como referidor.
 * @param {{ hasActiveMembership: boolean; hasActiveLicense: boolean; isDemo: boolean; userIsActive?: boolean; }} input - Estado resumido del tenant.
 * @returns {boolean} Elegibilidad final.
 */
export function isEligibleAffiliateTenant(input: {
  hasActiveMembership: boolean;
  hasActiveLicense: boolean;
  isDemo: boolean;
  userIsActive?: boolean;
}): boolean {
  return (
    input.hasActiveMembership &&
    input.hasActiveLicense &&
    input.isDemo === false &&
    input.userIsActive !== false
  );
}
