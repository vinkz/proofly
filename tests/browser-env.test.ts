import { describe, expect, it } from 'vitest';

import { detectInAppBrowser, hasAutomationScreen, browserEnvProperties } from '@/lib/browser-env';

/**
 * The fixtures are real: every user agent and screen size below was taken from
 * an actual session on /free-cp12 in the week of 2026-08-07. Synthetic strings
 * would only prove the regexes match themselves.
 */
const FACEBOOK_ANDROID =
  'Mozilla/5.0 (Linux; Android 16; SM-S931B Build/BP4A.251205.006) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.7922.134 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/574.0.0.40.71;IABMV/1;]';

const FACEBOOK_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G71 Safari/604.1 [FBAN/FBIOS;FBAV/573.0.0.47.73;FBBV/1032158285;FBDV/iPhone18,1;FBMD/iPhone;FBSN/iOS;FBSV/26.6;FBSS/3;FBID/phone;FBLC/en_GB;FBOP/5;FBRV/1036801823;IABMV/1]';

/** The Springfield crawler — Chrome 74, released 2019, on a 2000x2000 screen. */
const CRAWLER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36';

/** A real visitor: iPhone, Mobile Safari, arrived direct. */
const REAL_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

describe('detectInAppBrowser', () => {
  it('catches the Facebook Android WebView by its FB_IAB marker', () => {
    expect(detectInAppBrowser(FACEBOOK_ANDROID)).toEqual({ id: 'facebook', label: 'Facebook' });
  });

  it('catches the Facebook iOS WebView by its FBAN marker', () => {
    expect(detectInAppBrowser(FACEBOOK_IOS)).toEqual({ id: 'facebook', label: 'Facebook' });
  });

  it('leaves a real mobile browser alone', () => {
    expect(detectInAppBrowser(REAL_IPHONE)).toBeNull();
  });

  it('does not mistake a desktop crawler for an in-app browser', () => {
    expect(detectInAppBrowser(CRAWLER)).toBeNull();
  });

  it('handles a missing user agent rather than throwing', () => {
    expect(detectInAppBrowser(undefined)).toBeNull();
    expect(detectInAppBrowser(null)).toBeNull();
    expect(detectInAppBrowser('')).toBeNull();
  });
});

describe('hasAutomationScreen', () => {
  it('flags the square screen both crawlers reported', () => {
    expect(hasAutomationScreen(2000, 2000)).toBe(true);
  });

  it('leaves real phones alone', () => {
    // The Facebook iOS visitor and the Android one, respectively.
    expect(hasAutomationScreen(402, 874)).toBe(false);
    expect(hasAutomationScreen(412, 892)).toBe(false);
  });

  it('leaves ordinary desktop screens alone, including 5:4', () => {
    expect(hasAutomationScreen(1920, 1080)).toBe(false);
    expect(hasAutomationScreen(1280, 1024)).toBe(false);
    expect(hasAutomationScreen(2560, 1440)).toBe(false);
  });

  it('ignores small square values, which are stubs rather than crawlers', () => {
    expect(hasAutomationScreen(0, 0)).toBe(false);
    expect(hasAutomationScreen(1, 1)).toBe(false);
  });

  it('does not throw on missing dimensions', () => {
    expect(hasAutomationScreen(undefined, undefined)).toBe(false);
    expect(hasAutomationScreen(1000, undefined)).toBe(false);
  });
});

describe('browserEnvProperties', () => {
  it('is safe to call on the server, where there is no window', () => {
    // Vitest runs on the node environment, so this is the real server path.
    expect(browserEnvProperties()).toEqual({ in_app_browser: 'none', is_automated: false });
  });
});
