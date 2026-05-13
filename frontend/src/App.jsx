import React, { useMemo, useState } from 'react';

const users = [
  {
    key: 'independent',
    title: 'Independent User',
    accent: 'from-emerald-500/25 to-emerald-400/5',
    border: 'border-emerald-900/30',
    description: 'For users comfortable with smartphone applications.',
    example: ['Open Uber', 'Enter destination', 'Confirm ride'],
    detail: 'short'
  },
  {
    key: 'assisted',
    title: 'Assisted User',
    accent: 'from-amber-500/20 to-stone-200/10',
    border: 'border-amber-900/25',
    description: 'For users who need moderate smartphone guidance.',
    example: [
      'Open the Uber app from your home screen',
      'Tap the "Where to?" field',
      'Type your destination',
      'Choose your ride',
      'Confirm booking'
    ],
    detail: 'clear'
  },
  {
    key: 'guided',
    title: 'Guided User',
    accent: 'from-[#6a4b33]/25 to-[#f3e7d8]/12',
    border: 'border-[#8b6a4d]/30',
    description: 'For elderly or digitally inexperienced users.',
    example: [
      'Find the Uber icon on your phone screen and tap it once',
      'Wait for the application to fully open',
      'Tap the box that says “Where to?”',
      'Carefully type your destination',
      'Select the correct location from the list',
      'Choose your preferred ride option',
      'Tap “Confirm” to book your ride'
    ],
    detail: 'detailed'
  }
];

const presets = [
  'Book a cab to the airport',
  'Send a WhatsApp message',
  'Order food online',
  'Recharge mobile number'
];

const userTypeMeta = {
  independent: { label: 'Independent User', detail: 'Concise' },
  assisted: { label: 'Assisted User', detail: 'Balanced' },
  guided: { label: 'Guided User', detail: 'Highly detailed' }
};

const glass = 'rounded-[28px] border border-white/10 bg-white/60 backdrop-blur-xl shadow-[0_18px_60px_rgba(59,46,33,0.08)]';

function StepCard({ step, index }) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white/75 px-4 py-4 shadow-[0_10px_30px_rgba(56,43,32,0.05)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6a4b33] text-xs font-medium text-[#f7efe6]">
          {index + 1}
        </div>
        <div className="text-[15px] leading-7 text-stone-700">{step}</div>
      </div>
    </div>
  );
}

function App() {
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedUser, setSelectedUser] = useState('guided');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const activeUser = useMemo(() => users.find((u) => u.key === selectedUser) || users[2], [selectedUser]);

  const handleGenerate = async () => {
    if (!taskDescription.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const response = await fetch('/api/v1/showcase/adaptive-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskDescription: taskDescription.trim(),
          language: 'en'
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to generate guidance');
      setResults(data.plans || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4ede4] text-[#2f241c]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10rem] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(132,99,74,0.18),transparent_62%)] blur-3xl" />
        <div className="absolute right-[-6rem] top-[12rem] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(212,193,173,0.45),transparent_62%)] blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-4rem] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(106,75,51,0.12),transparent_65%)] blur-3xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className={`${glass} overflow-hidden px-6 py-14 sm:px-10 sm:py-16`}>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex rounded-full border border-[#d7c2ad] bg-[#fff8f1] px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-[#7c5f47]">
              Adaptive smartphone guidance
            </div>
            <h1 className="text-5xl font-semibold tracking-tight text-[#2f241c] sm:text-7xl">JUS&apos;TAPP</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#6f5b4d] sm:text-lg">
              JUS’TAPP helps users complete smartphone tasks using intelligent step-by-step guidance that adapts according to user understanding and interaction behavior.
            </p>

            <div className="mx-auto mt-8 max-w-2xl">
              <div className="rounded-[22px] border border-[#ddcfc2] bg-[#fffaf4]/90 p-2 shadow-[0_14px_40px_rgba(78,56,40,0.08)]">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerate();
                    }}
                    placeholder="Try something like 'Book a cab to the airport'"
                    className="h-14 flex-1 rounded-[18px] border border-transparent bg-transparent px-5 text-[15px] text-[#2f241c] outline-none placeholder:text-[#9a8777]"
                  />
                  <button
                    onClick={handleGenerate}
                    className="h-14 rounded-[18px] bg-[#3a2a20] px-6 text-sm font-medium text-[#f7efe6] transition hover:bg-[#2d2018] active:scale-[0.99]"
                  >
                    {loading ? 'Generating…' : 'Generate Guidance'}
                  </button>
                </div>
              </div>

              <div className="preset-grid mt-4">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setTaskDescription(p)}
                    className="preset-chip rounded-2xl border border-[#d8c4b2] bg-white/80 px-4 py-3 text-sm text-[#5f4c3d] transition hover:border-[#b99c81] hover:bg-[#fff8f1]"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {users.map((user) => {
            const active = user.key === selectedUser;
            return (
              <button
                key={user.key}
                onClick={() => setSelectedUser(user.key)}
                className={`text-left ${glass} overflow-hidden p-5 transition ${active ? 'ring-1 ring-[#6a4b33]/20' : ''}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${user.accent}`} />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#2f241c]">{user.title}</h2>
                    <div className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-[#6a4b33]' : 'bg-[#c1ab98]'}`} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6f5b4d]">{user.description}</p>
                  <div className="mt-5 space-y-2">
                    {user.example.slice(0, 3).map((step, idx) => (
                      <div key={step} className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-[#4b3b2f]">
                        {idx + 1}. {step}
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <section className={`${glass} p-6 sm:p-8`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#8d755f]">Selected user type</div>
              <div className="mt-2 text-2xl font-semibold text-[#2f241c]">{activeUser.title}</div>
            </div>
            <div className="rounded-full border border-[#d8c4b2] bg-[#fff9f3] px-4 py-2 text-sm text-[#6f5b4d]">
              {selectedUser === 'independent' ? 'Concise' : selectedUser === 'assisted' ? 'Balanced' : 'Highly detailed'}
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-[#ddcfc2] bg-[#fffaf4] p-5">
            <div className="text-sm font-medium text-[#6f5b4d]">Task input</div>
            <div className="mt-3 rounded-2xl border border-[#e5d8cc] bg-white px-4 py-3 text-sm text-[#2f241c]">
              {taskDescription || 'Book a cab to the airport'}
            </div>
            <div className="mt-4 text-sm leading-7 text-[#6f5b4d]">
              Generate once and each card below updates with its own plan.
            </div>
          </div>
        </section>

        <section className={`${glass} p-6 sm:p-8`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#8d755f]">Adaptive guidance</div>
              <div className="mt-2 text-2xl font-semibold text-[#2f241c]">Generated plans</div>
            </div>
            {loading && <div className="rounded-full bg-[#e7d7c6] px-3 py-1 text-xs text-[#6f5b4d]">Generating…</div>}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {users.map((user) => {
              const plan = results?.[user.key];
              return (
                <div key={user.key} className={`rounded-[24px] border border-[#ddcfc2] bg-white/75 p-4 ${user.border}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#6f5b4d]">{user.title}</div>
                      <div className="text-xs text-[#9a8777]">{userTypeMeta[user.key].detail}</div>
                    </div>
                    <div className="rounded-full border border-[#d8c4b2] bg-[#fff9f3] px-3 py-1 text-xs text-[#6f5b4d]">
                      {plan?.steps?.length || 0} steps
                    </div>
                  </div>

                  {plan ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-[#e5d8cc] bg-[#fffaf4] px-4 py-3 text-sm text-[#2f241c]">
                        {plan.appPackageName || 'Smartphone task'}
                      </div>
                      <div className="space-y-2">
                        {plan.steps.map((step, index) => (
                          <StepCard
                            key={`${user.key}-${step.stepIndex ?? index}-${index}`}
                            step={step.instruction || ''}
                            index={index}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#ddcfc2] bg-white/60 px-4 py-6 text-center text-xs leading-6 text-[#8d755f]">
                      {loading ? 'Generating premium guidance…' : 'Generate once to populate this card.'}
                    </div>
                  )}

                  {user.key === 'guided' && (
                    <div className="mt-4 rounded-full border border-[#d2b59c]/60 bg-[#fff5ea] px-3 py-2 text-center text-xs text-[#7c5f47]">
                      Guidance adapts according to user understanding and interaction behavior.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
