/**
 * The six placeholder screen panels used inside the device frame. Seeded with
 * realistic UK fake data per the brief ("14 Park Lane, M1 4AB", "Mr Ahmed",
 * "Gas Safe reg 512345"). Each maps 1:1 to a real screen the video wants:
 *   client-select · step 1 filled · step 2 appliances · issue · landlord prefill · dashboard
 */
import React from 'react';
import { colors, radius, weight } from '../theme';
import { AppHeader, Card, Chip, CtaButton, Eyebrow, Field, PhoneScreen, Pill, StepDots } from './primitives';

const pad = 34;

export const WizardClientSelect: React.FC = () => (
  <PhoneScreen>
    <AppHeader title="New certificate" />
    <div style={{ padding: pad, flex: 1 }}>
      <Eyebrow>Landlord gas safety · CP12</Eyebrow>
      <StepDots total={4} active={0} labels={['Select client', 'Property', 'Appliances', 'Issue']} />
      <div style={{ fontSize: 30, fontWeight: weight.medium, marginBottom: 24, letterSpacing: '-0.4px' }}>
        Who is this certificate for?
      </div>
      <div
        style={{
          height: 68,
          borderRadius: radius.banner,
          border: `1px solid ${colors.borderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          fontSize: 22,
          color: colors.textTertiary,
          marginBottom: 22,
        }}
      >
        Search clients…
      </div>
      {[
        { n: 'Mr Ahmed', a: '14 Park Lane, M1 4AB', sel: true },
        { n: 'S. Whitfield', a: '3 Croft Road, M20 2RN', sel: false },
        { n: 'Oakwood Lettings', a: '22 Oak Street, M14 5TB', sel: false },
      ].map((c) => (
        <Card
          key={c.n}
          style={{
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: c.sel ? colors.action : colors.borderTertiary,
            background: c.sel ? colors.actionBg : colors.backgroundPrimary,
          }}
        >
          <div>
            <div style={{ fontSize: 26, fontWeight: weight.medium }}>{c.n}</div>
            <div style={{ fontSize: 20, color: colors.textSecondary, marginTop: 6 }}>{c.a}</div>
          </div>
          {c.sel && (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.full,
                background: colors.action,
                color: colors.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
              }}
            >
              ✓
            </div>
          )}
        </Card>
      ))}
    </div>
  </PhoneScreen>
);

export const WizardStep1: React.FC = () => (
  <PhoneScreen>
    <AppHeader title="Step 1 of 4" />
    <div style={{ padding: pad, flex: 1 }}>
      <Eyebrow>Property & landlord</Eyebrow>
      <StepDots total={4} active={1} labels={['Select client', 'Property', 'Appliances', 'Issue']} />
      <Field label="Property address" value="14 Park Lane, M1 4AB" filled />
      <Field label="Landlord" value="Mr Ahmed" filled />
      <Field label="Inspection date" value="7 July 2026" filled />
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <Field label="Gas Safe reg" value="512345" filled />
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Records held" value="1 year" filled />
        </div>
      </div>
    </div>
  </PhoneScreen>
);

export const WizardStep2: React.FC = () => (
  <PhoneScreen>
    <AppHeader title="Step 2 of 4" />
    <div style={{ padding: pad, flex: 1 }}>
      <Eyebrow>Appliance</Eyebrow>
      <StepDots total={4} active={2} labels={['Select client', 'Property', 'Appliances', 'Issue']} />
      <div style={{ fontSize: 22, color: colors.textSecondary, marginBottom: 14, fontWeight: weight.medium }}>
        Appliance type
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 30 }}>
        <Chip selected>Combi boiler</Chip>
        <Chip>System boiler</Chip>
        <Chip>Cooker</Chip>
        <Chip>Fire</Chip>
      </div>
      <Field label="Make" value="Worcester Bosch" filled />
      <Field label="Model" value="Greenstar 30i" filled />
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <Field label="Location" value="Kitchen" filled />
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Serial" value="7731600123" filled />
        </div>
      </div>
    </div>
  </PhoneScreen>
);

export const IssueScreen: React.FC = () => (
  <PhoneScreen>
    <AppHeader title="Step 4 of 4" />
    <div style={{ padding: pad, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Eyebrow>Sign & issue</Eyebrow>
      <StepDots total={4} active={3} labels={['Select client', 'Property', 'Appliances', 'Issue']} />
      <Card style={{ background: colors.actionBg, borderColor: colors.action, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.full,
              background: colors.action,
              color: colors.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 25, fontWeight: weight.medium, color: colors.action }}>
            All required items complete
          </div>
        </div>
      </Card>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 21, color: colors.textSecondary, marginBottom: 12 }}>
          Regulation 26(9) confirmed
        </div>
        <div style={{ height: 150, borderRadius: radius.banner, border: `1px dashed ${colors.borderPrimary}`, display: 'flex', alignItems: 'flex-end', padding: 20 }}>
          <span style={{ fontFamily: 'cursive', fontSize: 46, color: colors.textPrimary, opacity: 0.85 }}>A. Ahmed</span>
        </div>
      </Card>
      <div style={{ flex: 1 }} />
      <CtaButton tone="action">Issue certificate</CtaButton>
    </div>
  </PhoneScreen>
);

export const LandlordPrefill: React.FC = () => (
  <PhoneScreen>
    <AppHeader title="Ask the landlord" />
    <div style={{ padding: pad, flex: 1 }}>
      <Eyebrow>Prefill by link</Eyebrow>
      <div style={{ fontSize: 30, fontWeight: weight.medium, marginBottom: 10, letterSpacing: '-0.4px' }}>
        Let the landlord fill their own details
      </div>
      <div style={{ fontSize: 21, color: colors.textSecondary, lineHeight: 1.5, marginBottom: 26 }}>
        Send a secure link. Their answers drop straight into the certificate.
      </div>
      <Card style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 22, color: colors.action, fontWeight: weight.medium }}>
          certnow.uk/prefill/cn-512345
        </span>
        <Pill tone="action">Copy</Pill>
      </Card>
      <div style={{ fontSize: 20, color: colors.textTertiary, marginBottom: 12 }}>Or send by email</div>
      <Card>
        <div style={{ fontSize: 21, color: colors.textSecondary, marginBottom: 6 }}>To: Mr Ahmed</div>
        <div style={{ fontSize: 24, fontWeight: weight.medium, marginBottom: 14 }}>
          Your gas safety details for 14 Park Lane
        </div>
        <div style={{ fontSize: 20, color: colors.textSecondary, lineHeight: 1.55 }}>
          Hi Mr Ahmed — tap the link to confirm the property and appliance details for your CP12. Two
          minutes, no account needed.
        </div>
        <div style={{ marginTop: 20 }}>
          <CtaButton tone="cta">Send prefill request</CtaButton>
        </div>
      </Card>
    </div>
  </PhoneScreen>
);

export const DashboardList: React.FC = () => {
  const rows = [
    { a: '14 Park Lane', p: 'M1 4AB', tone: 'action' as const, s: 'Current · to Jul 2027' },
    { a: '3 Croft Road', p: 'M20 2RN', tone: 'amber' as const, s: 'Due in 21 days' },
    { a: '22 Oak Street', p: 'M14 5TB', tone: 'red' as const, s: 'Overdue · 6 days' },
    { a: '8 Elm Grove', p: 'M4 1HN', tone: 'action' as const, s: 'Current · to Mar 2027' },
    { a: '51 Hill Rd', p: 'M19 3PL', tone: 'amber' as const, s: 'Due in 34 days' },
    { a: '2 Vale Close', p: 'M21 9BQ', tone: 'action' as const, s: 'Current · to Nov 2027' },
  ];
  return (
    <PhoneScreen>
      <AppHeader title="Properties" />
      <div style={{ padding: pad, flex: 1 }}>
        <Eyebrow>Your portfolio</Eyebrow>
        <div style={{ fontSize: 30, fontWeight: weight.medium, marginBottom: 24, letterSpacing: '-0.4px' }}>
          14 properties
        </div>
        {rows.map((r) => (
          <Card
            key={r.a}
            style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ fontSize: 25, fontWeight: weight.medium }}>{r.a}</div>
              <div style={{ fontSize: 19, color: colors.textTertiary, marginTop: 5 }}>{r.p}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <Pill tone={r.tone}>{r.tone === 'action' ? 'Pass' : r.tone === 'amber' ? 'Due soon' : 'Overdue'}</Pill>
              <span style={{ fontSize: 17, color: colors.textTertiary }}>{r.s}</span>
            </div>
          </Card>
        ))}
      </div>
    </PhoneScreen>
  );
};

export const PANELS = {
  clientSelect: WizardClientSelect,
  step1: WizardStep1,
  step2: WizardStep2,
  issue: IssueScreen,
  prefill: LandlordPrefill,
  dashboard: DashboardList,
} as const;

export type PanelKey = keyof typeof PANELS;
