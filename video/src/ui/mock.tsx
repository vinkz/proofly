import React from 'react';
import { colors, radius, fontFamily, weight } from '../theme';
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconClipboard,
  IconFileCheck,
  IconFolder,
  IconMail,
  IconMenu,
  IconPlus,
  IconRepeat,
} from './icons';

/**
 * Stylised CertNow UI in the landing-page language (design-token colours,
 * feather icons, Pass pills, progress bars). These are the idealised product
 * screens shown inside the device frame — self-contained, no screenshots.
 */

const SCREEN_W = 640;
const PAD = 34;

// Panels are content-height (like the landing-page phone mock) — no dead space.
export const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ width: SCREEN_W, background: colors.backgroundSecondary, fontFamily, color: colors.textPrimary, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    {children}
  </div>
);

const Wordmark: React.FC = () => (
  <span style={{ fontSize: 30, fontWeight: weight.wordmark, letterSpacing: '-0.5px', color: colors.textPrimary }}>certnow</span>
);

const StepPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ borderRadius: radius.full, background: colors.backgroundPrimary, padding: '8px 18px', fontSize: 20, fontWeight: weight.medium, color: colors.textSecondary, border: `0.5px solid ${colors.borderTertiary}` }}>{children}</span>
);

export const TopBar: React.FC<{ step?: string; menu?: boolean }> = ({ step, menu }) => (
  <div style={{ background: colors.backgroundPrimary, borderBottom: `0.5px solid ${colors.borderTertiary}`, padding: '26px 34px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
    <Wordmark />
    {step ? <StepPill>{step}</StepPill> : menu ? <span style={{ color: colors.textSecondary }}><IconMenu s={30} /></span> : null}
  </div>
);

const Progress: React.FC<{ pct: number }> = ({ pct }) => (
  <div style={{ height: 8, borderRadius: radius.full, background: colors.borderSecondary, margin: '0 0 26px' }}>
    <div style={{ height: '100%', width: `${pct}%`, borderRadius: radius.full, background: colors.action }} />
  </div>
);

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 17, textTransform: 'uppercase', letterSpacing: '2px', color: colors.textEyebrow, fontWeight: weight.medium, marginBottom: 10 }}>{children}</div>
);

const H1: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 34, fontWeight: weight.medium, letterSpacing: '-0.5px', marginBottom: 22 }}>{children}</div>
);

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ borderRadius: radius.card, border: `0.5px solid ${colors.borderTertiary}`, background: colors.backgroundPrimary, padding: 24, ...style }}>{children}</div>
);

const IconTile: React.FC<{ children: React.ReactNode; tone?: 'action' | 'muted' }> = ({ children, tone = 'action' }) => (
  <div style={{ width: 64, height: 64, borderRadius: radius.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: tone === 'action' ? colors.actionBg : colors.backgroundTertiary, color: tone === 'action' ? colors.action : colors.textSecondary }}>{children}</div>
);

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 18, color: colors.textSecondary, marginBottom: 8, fontWeight: weight.medium }}>{label}</div>
    <div style={{ height: 64, borderRadius: radius.banner, border: `1px solid ${colors.borderSecondary}`, background: colors.backgroundPrimary, display: 'flex', alignItems: 'center', padding: '0 20px', fontSize: 23, fontWeight: weight.medium }}>{value}</div>
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; selected?: boolean }> = ({ children, selected }) => (
  <div style={{ height: 58, padding: '0 26px', borderRadius: radius.full, display: 'flex', alignItems: 'center', fontSize: 22, fontWeight: weight.medium, border: `1px solid ${selected ? colors.action : colors.borderPrimary}`, background: selected ? colors.actionBg : colors.backgroundPrimary, color: selected ? colors.action : colors.textSecondary }}>{children}</div>
);

type Tone = 'action' | 'amber' | 'red';
const toneMap: Record<Tone, { bg: string; fg: string }> = {
  action: { bg: colors.actionBg, fg: colors.action },
  amber: { bg: colors.amberBg, fg: colors.amber },
  red: { bg: colors.redBg, fg: colors.red },
};
const Pill: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => {
  const c = toneMap[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: radius.full, padding: '7px 16px', fontSize: 18, fontWeight: weight.medium, background: c.bg, color: c.fg }}><span style={{ width: 11, height: 11, borderRadius: radius.full, background: c.fg }} />{children}</span>;
};

const CheckRow: React.FC<{ label: string; value?: string; tone?: Tone }> = ({ label, value = 'Pass', tone = 'action' }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${colors.borderTertiary}` }}>
    <span style={{ fontSize: 22, color: colors.textSecondary }}>{label}</span>
    <Pill tone={tone}>{value}</Pill>
  </div>
);

const StatusBanner: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderRadius: radius.banner, background: colors.actionBg, padding: '18px 22px' }}>
    <span style={{ color: colors.action }}><IconCheck s={30} /></span>
    <span style={{ fontSize: 24, fontWeight: weight.medium, color: colors.action }}>{text}</span>
  </div>
);

const CtaButton: React.FC<{ children: React.ReactNode; tone?: 'cta' | 'action' }> = ({ children, tone = 'cta' }) => (
  <div style={{ height: 84, borderRadius: radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 26, fontWeight: weight.medium, background: tone === 'action' ? colors.action : colors.cta, color: colors.white }}>{children}</div>
);

const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: PAD, flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
);

// ---------------- Panels ----------------

const StartRow: React.FC<{ icon: React.ReactNode; title: string; body: string; end: React.ReactNode; highlight?: boolean }> = ({ icon, title, body, end, highlight }) => (
  <Card style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 18, borderColor: highlight ? colors.action : colors.borderTertiary, background: highlight ? colors.actionBg : colors.backgroundPrimary }}>
    <IconTile>{icon}</IconTile>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 25, fontWeight: weight.medium }}>{title}</div>
      <div style={{ fontSize: 19, color: colors.textSecondary, marginTop: 4, lineHeight: 1.4 }}>{body}</div>
    </div>
    <span style={{ color: colors.textTertiary }}>{end}</span>
  </Card>
);

export const NewJobStart: React.FC = () => (
  <Screen>
    <TopBar menu />
    <Body>
      <Eyebrow>New job · CP12</Eyebrow>
      <H1>How do you want to start?</H1>
      <StartRow icon={<IconClipboard s={30} />} title="Fill myself" body="Open the landlord and property form now." end={<IconArrowRight s={28} />} />
      <StartRow icon={<IconMail s={30} />} title="Ask landlord" body="Send your request link by email or SMS." end={<IconPlus s={28} />} highlight />
      <StartRow icon={<IconFolder s={30} />} title="Existing landlord" body="Reuse a saved landlord and property." end={<IconArrowRight s={28} />} />
    </Body>
  </Screen>
);

export const ClientReuse: React.FC = () => (
  <Screen>
    <TopBar step="Step 1 of 4" />
    <Body>
      <Progress pct={25} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <Eyebrow>Landlord &amp; property</Eyebrow>
        <Pill tone="action">Prefilled from last visit</Pill>
      </div>
      <Field label="Landlord" value="Mr Ahmed" />
      <Field label="Property address" value="14 Park Lane, M1 4AB" />
      <div style={{ display: 'flex', gap: 18 }}>
        <div style={{ flex: 1 }}><Field label="Tenant" value="S. Rana" /></div>
        <div style={{ flex: 1 }}><Field label="Records held" value="1 year" /></div>
      </div>
      <div style={{ height: 8 }} />
      <CtaButton>Next<IconArrowRight s={26} /></CtaButton>
    </Body>
  </Screen>
);

export const ApplianceIdentity: React.FC = () => (
  <Screen>
    <TopBar step="Step 2 of 4" />
    <Body>
      <Progress pct={50} />
      <Eyebrow>Appliance 1</Eyebrow>
      <div style={{ fontSize: 22, color: colors.textSecondary, marginBottom: 12, fontWeight: weight.medium }}>Appliance type</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
        <Chip selected>Boiler</Chip><Chip>Cooker</Chip><Chip>Fire</Chip><Chip>Water heater</Chip>
      </div>
      <div style={{ fontSize: 22, color: colors.textSecondary, marginBottom: 12, fontWeight: weight.medium }}>Boiler type</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Chip selected>Combi</Chip><Chip>System</Chip><Chip>Regular</Chip>
      </div>
      <div style={{ display: 'flex', gap: 18 }}>
        <div style={{ flex: 1 }}><Field label="Make" value="Vaillant" /></div>
        <div style={{ flex: 1 }}><Field label="Model" value="ecoTEC plus" /></div>
      </div>
      <Field label="Location" value="Kitchen" />
    </Body>
  </Screen>
);

export const ApplianceChecks: React.FC = () => (
  <Screen>
    <TopBar step="Step 3 of 4" />
    <Body>
      <Progress pct={75} />
      <Eyebrow>Appliance checks</Eyebrow>
      <H1>Appliance 1</H1>
      <Card style={{ marginBottom: 22, padding: '8px 24px' }}>
        <CheckRow label="Burner pressure" />
        <CheckRow label="Gas rate" />
        <CheckRow label="Safety device" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
          <span style={{ fontSize: 22, color: colors.textSecondary }}>Flue &amp; ventilation</span>
          <Pill tone="action">Pass</Pill>
        </div>
      </Card>
      <StatusBanner text="All checks passed" />
    </Body>
  </Screen>
);

export const SignIssue: React.FC = () => (
  <Screen>
    <TopBar step="Step 4 of 4" />
    <Body>
      <Progress pct={100} />
      <Eyebrow>Sign &amp; issue</Eyebrow>
      <StatusBanner text="All required items complete" />
      <Card style={{ margin: '20px 0' }}>
        <div style={{ fontSize: 20, color: colors.textSecondary, marginBottom: 12 }}>Engineer signature</div>
        <div style={{ height: 140, borderRadius: radius.banner, border: `1px dashed ${colors.borderPrimary}`, display: 'flex', alignItems: 'flex-end', padding: 18 }}>
          <span style={{ fontFamily: 'cursive', fontSize: 44 }}>A. Jones</span>
        </div>
      </Card>
      <div style={{ height: 8 }} />
      <CtaButton tone="action">Issue certificate</CtaButton>
    </Body>
  </Screen>
);

const StatTile: React.FC<{ value: string; label: string; tone?: Tone }> = ({ value, label, tone }) => (
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 44, fontWeight: weight.medium, color: tone ? toneMap[tone].fg : colors.textPrimary }}>{value}</div>
    <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.textTertiary, marginTop: 2 }}>{label}</div>
  </div>
);

const PropertyRow: React.FC<{ addr: string; sub: string; tone: Tone; label: string }> = ({ addr, sub, tone, label }) => (
  <Card style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
    <IconTile tone="muted"><IconBuilding s={30} /></IconTile>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 24, fontWeight: weight.medium }}>{addr}</div>
      <div style={{ fontSize: 18, color: colors.textTertiary, marginTop: 4 }}>{sub}</div>
    </div>
    <Pill tone={tone}>{label}</Pill>
  </Card>
);

export const PropertyList: React.FC = () => (
  <Screen>
    <TopBar menu />
    <Body>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 34, fontWeight: weight.medium }}>Properties</div>
        <IconTile tone="muted"><IconPlus s={28} /></IconTile>
      </div>
      <Card style={{ display: 'flex', marginBottom: 22 }}>
        <StatTile value="14" label="Total" />
        <StatTile value="2" label="Overdue" tone="red" />
        <StatTile value="3" label="Due soon" tone="amber" />
        <StatTile value="9" label="Current" tone="action" />
      </Card>
      <PropertyRow addr="14 Park Lane" sub="M1 4AB · to Jul 2027" tone="action" label="Current" />
      <PropertyRow addr="3 Croft Road" sub="M20 2RN · due in 21 days" tone="amber" label="Due soon" />
      <PropertyRow addr="22 Oak Street" sub="M14 5TB · overdue 6 days" tone="red" label="Overdue" />
      <PropertyRow addr="8 Elm Grove" sub="M4 1HN · to Mar 2027" tone="action" label="Current" />
      <PropertyRow addr="51 Hill Road" sub="M19 3PL · due in 34 days" tone="amber" label="Due soon" />
    </Body>
  </Screen>
);

export const LandlordVault: React.FC = () => (
  <Screen>
    <TopBar />
    <Body>
      <Eyebrow>Property vault</Eyebrow>
      <H1>14 Park Lane, M1 4AB</H1>
      <Card style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <IconTile><IconFileCheck s={30} /></IconTile>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: weight.medium }}>CP12 certificate</div>
          <div style={{ fontSize: 19, color: colors.textSecondary, marginTop: 3 }}>Current · next check Jul 2027</div>
        </div>
        <Pill tone="action">Valid</Pill>
      </Card>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, color: colors.textEyebrow, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 10 }}>Engineer</div>
        <div style={{ fontSize: 24, fontWeight: weight.medium }}>Jones Gas Services</div>
        <div style={{ fontSize: 19, color: colors.textSecondary, marginTop: 4 }}>Gas Safe 654321 · Alex Jones</div>
      </Card>
      <Card style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <IconTile tone="muted"><IconRepeat s={30} /></IconTile>
        <div style={{ flex: 1, fontSize: 21, color: colors.textSecondary }}>Renewal reminder set for June 2027</div>
      </Card>
      <div style={{ height: 8 }} />
      <CtaButton>Book next service</CtaButton>
    </Body>
  </Screen>
);

export const PANELS = {
  newJob: NewJobStart,
  clientReuse: ClientReuse,
  appliance: ApplianceIdentity,
  checks: ApplianceChecks,
  issue: SignIssue,
  properties: PropertyList,
  vault: LandlordVault,
} as const;

export type PanelKey = keyof typeof PANELS;
