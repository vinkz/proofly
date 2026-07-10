'use client';

import posthog from 'posthog-js';

export function LogoutButton() {
  const handleSubmit = () => {
    posthog.reset();
  };

  return (
    <form action="/logout" method="post">
      <button
        type="submit"
        onClick={handleSubmit}
        className="rounded-full border-[0.5px] border-[#f09595] bg-[#fcebeb] px-[12px] py-[5px] text-[12px] font-medium text-[#a32d2d]"
      >
        Sign out
      </button>
    </form>
  );
}
