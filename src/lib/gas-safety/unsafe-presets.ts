// Quick-select presets for unsafe-appliance / warning-notice capture, grounded in the
// GIUSP unsafe situations (Immediately Dangerous / At Risk) and standard engineer
// actions. Shared by the CP12 wizard and the Gas Warning Notice wizard so the wording
// stays consistent. Tapping a chip appends the text to a free-text field; the engineer
// can still type or edit it freely.

export const UNSAFE_SITUATION_PRESETS = [
  'Inadequate ventilation / air supply',
  'Products of combustion spilling into room',
  'Flue not terminating safely / defective flue',
  'Blocked or restricted flue',
  'Excessive CO detected',
  'Gas leak / tightness test failure',
  'No / inoperative flame supervision device',
  'Appliance in prohibited location',
  'Corroded / damaged heat exchanger',
  'Incorrect operating pressure',
  'Unstable / insecure appliance',
  'Appliance not to current standards',
];

export const ACTION_TAKEN_PRESETS = [
  'Appliance turned off',
  'Gas supply isolated / capped',
  'Warning notice issued',
  'Danger Do Not Use label attached',
  'Responsible person advised of danger',
  'Made safe',
  'Gas Emergency Service notified (ID)',
  'RIDDOR report submitted (ID)',
];

export const ACTION_REQUIRED_PRESETS = [
  'Replace appliance',
  'Repair / replace flue',
  'Provide adequate ventilation',
  'Service appliance',
  'Investigate and repair gas leak',
  'Reposition appliance',
  'Replace faulty component',
  'Manufacturer / specialist inspection',
];

export const UNDERLYING_CAUSE_PRESETS = [
  'Component failure',
  'Lack of maintenance / servicing',
  'Incorrect / non-compliant installation',
  'Blockage or debris',
  'Corrosion',
  'Seal / gasket deterioration',
  'Wear over time',
];

// Append a preset to a semicolon-separated free-text field, skipping duplicates.
export const appendPresetSnippet = (current: string | undefined | null, snippet: string): string => {
  const value = (current ?? '').trim();
  const parts = value ? value.split(/;\s*/).map((s) => s.trim()).filter(Boolean) : [];
  if (parts.some((part) => part.toLowerCase() === snippet.toLowerCase())) return value;
  return value ? `${value}; ${snippet}` : snippet;
};
