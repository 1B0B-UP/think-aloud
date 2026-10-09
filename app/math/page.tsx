'use client';

import { useState } from 'react';
import AiChat from '@/components/AiChat';
import MathText from '@/components/MathText';
import type { ChatContext } from '@/app/api/chat/route';

interface MathProblem {
  prompt: string;
  answer: string;
  steps: string[];
  eeUse: string;
}

interface MathUnit {
  name: string;
  focus: string;
  problem: MathProblem;
}

interface MathCourse {
  id: string;
  title: string;
  term: string;
  purpose: string;
  refreshGoal: string;
  units: MathUnit[];
}

const COURSES: MathCourse[] = [
  {
    id: 'calc-1',
    title: 'Calculus I',
    term: 'Start here',
    purpose: 'Limits, derivatives, curve behavior, optimization, and basic integrals.',
    refreshGoal: 'Get fluent with rates of change before moving into circuits, fields, and signals.',
    units: [
      {
        name: 'Limits and continuity',
        focus: 'One-sided limits, removable discontinuities, asymptotes, and limit laws.',
        problem: {
          prompt: 'Evaluate lim x→2 (x² - 4)/(x - 2).',
          answer: '4',
          steps: ['Factor x² - 4 as (x - 2)(x + 2).', 'Cancel the nonzero factor x - 2 for x near 2.', 'Evaluate x + 2 at x = 2 to get 4.'],
          eeUse: 'Limits are the language behind transient behavior, stability margins, and idealized component models.',
        },
      },
      {
        name: 'Derivatives',
        focus: 'Power, product, quotient, and chain rules with physical meaning.',
        problem: {
          prompt: 'Find d/dt of v(t)=5e⁻²ᵗ cos(3t).',
          answer: "v′(t)=5e⁻²ᵗ(-2cos(3t)-3sin(3t))",
          steps: ['Use the product rule on e⁻²ᵗ and cos(3t).', 'Derivative of e⁻²ᵗ is -2e⁻²ᵗ.', 'Derivative of cos(3t) is -3sin(3t).', 'Factor 5e⁻²ᵗ.'],
          eeUse: 'This exact pattern appears in damped natural responses of RLC circuits and second-order controls.',
        },
      },
      {
        name: 'Optimization',
        focus: 'Critical points, first derivative test, and engineering constraints.',
        problem: {
          prompt: 'A power curve is P(R)=100R/(R+10)^2. What R maximizes P for R>0?',
          answer: 'R = 10 ohms',
          steps: ['Differentiate P(R) using product or quotient form.', 'P′(R)=100(10-R)/(R+10)³.', 'Set P′(R)=0, giving R=10.', 'The derivative changes from positive to negative, so this is a maximum.'],
          eeUse: 'This is the maximum power transfer result: load resistance equals source resistance.',
        },
      },
    ],
  },
  {
    id: 'calc-2',
    title: 'Calculus II',
    term: 'After Calc I',
    purpose: 'Integration techniques, sequences, series, parametric curves, and polar forms.',
    refreshGoal: 'Rebuild integral fluency and series intuition used in signals, filters, and approximations.',
    units: [
      {
        name: 'Integration techniques',
        focus: 'Substitution, integration by parts, partial fractions, and improper integrals.',
        problem: {
          prompt: 'Evaluate ∫₀∞ e⁻³ᵗ dt.',
          answer: '1/3',
          steps: ['Antiderivative of e⁻³ᵗ is -(1/3)e⁻³ᵗ.', 'At ∞ the exponential term goes to 0.', 'At 0 the antiderivative is -1/3.', 'Subtract to get 0 - (-1/3)=1/3.'],
          eeUse: 'Exponential integrals appear in average energy, impulse responses, and RC/RL decay calculations.',
        },
      },
      {
        name: 'Series',
        focus: 'Geometric series, Taylor series, convergence, and approximations.',
        problem: {
          prompt: 'Use the first three nonzero terms of eˣ to approximate e⁰·¹.',
          answer: '1.105',
          steps: ['Use eˣ = 1 + x + x²/2! + ...', 'Substitute x=0.1.', 'Compute 1 + 0.1 + 0.01/2 = 1.105.'],
          eeUse: 'Small-signal models and linearization often come from truncating Taylor series.',
        },
      },
      {
        name: 'Polar and parametric forms',
        focus: 'Parametric derivatives, polar area, and curve interpretation.',
        problem: {
          prompt: 'For x=cos(t), y=sin(t), find dy/dx at t=π/4.',
          answer: '-1',
          steps: ['dy/dt = cos(t).', 'dx/dt = -sin(t).', 'dy/dx = (dy/dt)/(dx/dt) = -cot(t).', 'At π/4, cot(t)=1, so dy/dx=-1.'],
          eeUse: 'Parametric thinking helps with phasors, rotating machines, and signal trajectories.',
        },
      },
    ],
  },
  {
    id: 'calc-3',
    title: 'Calculus III',
    term: 'Multivariable',
    purpose: 'Vectors, partial derivatives, gradients, multiple integrals, and vector calculus.',
    refreshGoal: 'Reconnect math to fields, coordinate systems, and electromagnetic intuition.',
    units: [
      {
        name: 'Partial derivatives and gradients',
        focus: 'Multivariable rates of change, directional derivatives, and gradients.',
        problem: {
          prompt: 'For f(x,y)=x²y+3y², find ∇f at (2,1).',
          answer: '<4, 10>',
          steps: ['∂f/∂x = 2xy.', '∂f/∂y = x² + 6y.', 'At (2,1), ∂f/∂x=4 and ∂f/∂y=10.', 'So ∇f=⟨4,10⟩.'],
          eeUse: 'Gradients show up in electric fields, optimization, controls tuning, and machine learning cost functions.',
        },
      },
      {
        name: 'Multiple integrals',
        focus: 'Area, volume, mass, average value, and changing integration order.',
        problem: {
          prompt: 'Evaluate ∫₀²∫₀³ xy dy dx.',
          answer: '9',
          steps: ['Integrate with respect to y first: ∫xy dy = xy²/2 from 0 to 3 = 9x/2.', 'Integrate 9x/2 from 0 to 2.', 'Result is (9/4)·4 = 9.'],
          eeUse: 'Double and triple integrals support field energy, charge distribution, and thermal/power density calculations.',
        },
      },
      {
        name: 'Vector calculus',
        focus: 'Divergence, curl, line integrals, flux, and theorem intuition.',
        problem: {
          prompt: 'For F=⟨xy, y²⟩, compute ∇·F.',
          answer: '3y',
          steps: ['Divergence in 2D is ∂F₁/∂x + ∂F₂/∂y.', '∂(xy)/∂x = y.', '∂(y²)/∂y = 2y.', '∇·F = y + 2y = 3y.'],
          eeUse: 'Divergence and curl are the compact language of Maxwell equations.',
        },
      },
    ],
  },
  {
    id: 'diff-eq',
    title: 'Differential Equations',
    term: 'Core EE math',
    purpose: 'First-order systems, second-order systems, Laplace methods, and forcing functions.',
    refreshGoal: 'Make transient response, poles, damping, and forced response feel natural again.',
    units: [
      {
        name: 'First-order equations',
        focus: 'Separable equations, linear equations, time constants, and steady state.',
        problem: {
          prompt: 'Solve dy/dt + 4y = 8, y(0)=1.',
          answer: 'y(t)=2-e⁻⁴ᵗ',
          steps: ['Steady-state solution is y=2.', 'Homogeneous solution is C e⁻⁴ᵗ.', 'So y=2+C e⁻⁴ᵗ.', 'Use y(0)=1 to get C=-1.'],
          eeUse: 'This is the same form as RC and RL step responses.',
        },
      },
      {
        name: 'Second-order systems',
        focus: 'Characteristic equations, damping, natural frequency, and oscillation.',
        problem: {
          prompt: 'Classify y\" + 2y\' + 5y = 0.',
          answer: 'Underdamped with roots -1 +/- 2j',
          steps: ['Characteristic equation is r² + 2r + 5 = 0.', 'Use quadratic formula: r=(-2 ± √(4-20))/2.', 'This gives r=-1 ± 2j.', 'Complex roots with negative real part mean decaying oscillation.'],
          eeUse: 'RLC circuits, motor dynamics, and control loops use this exact classification.',
        },
      },
      {
        name: 'Laplace transforms',
        focus: 'Transform pairs, initial conditions, transfer functions, and inverse transforms.',
        problem: {
          prompt: 'Find the inverse Laplace transform of 3/(s+2).',
          answer: '3e⁻²ᵗ',
          steps: ['Recall L{e⁻ᵃᵗ} = 1/(s+a).', 'Here a=2.', 'Scale by 3 to get 3e⁻²ᵗ.'],
          eeUse: 'Laplace transforms bridge circuit differential equations and transfer functions.',
        },
      },
    ],
  },
  {
    id: 'linear-algebra',
    title: 'Linear Algebra',
    term: 'Systems language',
    purpose: 'Matrices, vector spaces, eigenvalues, linear systems, and state-space thinking.',
    refreshGoal: 'Get comfortable with matrix models used in controls, circuits, estimation, and numerical tools.',
    units: [
      {
        name: 'Linear systems',
        focus: 'Solving Ax=b, rank, pivots, and conditioning.',
        problem: {
          prompt: 'Solve 2x+y=5 and x-y=1.',
          answer: 'x=2, y=1',
          steps: ['From x-y=1, y=x-1.', 'Substitute into 2x+y=5.', '2x+x-1=5, so 3x=6.', 'x=2 and y=1.'],
          eeUse: 'Nodal and mesh analysis are matrix problems.',
        },
      },
      {
        name: 'Eigenvalues',
        focus: 'Modes, stability, diagonalization, and repeated application.',
        problem: {
          prompt: 'Find eigenvalues of [[2,0],[0,5]].',
          answer: '2 and 5',
          steps: ['For a diagonal matrix, eigenvalues are the diagonal entries.', 'Equivalently det(A-λI)=(2-λ)(5-λ).', 'Set equal to zero to get λ=2 or 5.'],
          eeUse: 'Eigenvalues describe natural modes of state-space systems and coupled networks.',
        },
      },
      {
        name: 'State-space basics',
        focus: 'x-dot = Ax + Bu, outputs, and interpreting system matrices.',
        problem: {
          prompt: 'If ẋ = -3x with x(0)=4, what is x(t)?',
          answer: 'x(t)=4e⁻³ᵗ',
          steps: ['Scalar state equation ẋ = ax has solution x(t)=x(0)eᵃᵗ.', 'Here a=-3 and x(0)=4.', 'So x(t)=4e⁻³ᵗ.'],
          eeUse: 'This is the one-state version of modern control and simulation models.',
        },
      },
    ],
  },
  {
    id: 'prob-stats',
    title: 'Probability and Statistics',
    term: 'Noise and reliability',
    purpose: 'Random variables, distributions, expectation, variance, estimation, and confidence.',
    refreshGoal: 'Reconnect probability to measurement noise, communications, reliability, and test data.',
    units: [
      {
        name: 'Expected value and variance',
        focus: 'Mean, spread, standard deviation, and linear transformations.',
        problem: {
          prompt: 'A noise source has mean 0 and variance 16 V^2. What is its standard deviation?',
          answer: '4 V',
          steps: ['Standard deviation is the square root of variance.', '√(16 V²)=4 V.'],
          eeUse: 'Noise specs usually use RMS or standard deviation, not variance directly.',
        },
      },
      {
        name: 'Common distributions',
        focus: 'Normal, exponential, binomial, Poisson, and engineering interpretation.',
        problem: {
          prompt: 'For a Poisson process with λ=3 events/hour, what is P(0 events in one hour)?',
          answer: 'e⁻³, about 0.0498',
          steps: ['Poisson probability is P(k)=e⁻λ λᵏ/k!.', 'For k=0, λ⁰=1 and 0!=1.', 'P(0)=e⁻³.'],
          eeUse: 'Poisson models show up in arrivals, faults, photon counts, and rare-event reliability.',
        },
      },
      {
        name: 'Estimation',
        focus: 'Sample mean, confidence intervals, error bars, and uncertainty.',
        problem: {
          prompt: 'Four measurements are 9, 10, 10, 11. What is the sample mean?',
          answer: '10',
          steps: ['Add the measurements: 9+10+10+11=40.', 'Divide by n=4.', 'Mean is 10.'],
          eeUse: 'Test engineering depends on summarizing measurements and knowing how much to trust them.',
        },
      },
    ],
  },
  {
    id: 'discrete',
    title: 'Discrete Math',
    term: 'Digital logic support',
    purpose: 'Logic, sets, counting, recursion, graphs, and proof habits.',
    refreshGoal: 'Sharpen the math behind digital systems, software, networks, and state machines.',
    units: [
      {
        name: 'Logic and Boolean algebra',
        focus: 'Truth tables, equivalence, De Morgan laws, and simplification.',
        problem: {
          prompt: 'Simplify ¬(A ∧ B) using De Morgan law.',
          answer: '¬A ∨ ¬B',
          steps: ['De Morgan law flips ∧ to ∨.', 'Negate each input.', 'So ¬(A ∧ B) = ¬A ∨ ¬B.'],
          eeUse: 'Boolean simplification maps directly to gate-level logic and HDL thinking.',
        },
      },
      {
        name: 'Counting',
        focus: 'Permutations, combinations, product rule, and binary states.',
        problem: {
          prompt: 'How many states can an 8-bit register represent?',
          answer: '256',
          steps: ['Each bit has 2 possible values.', 'For 8 independent bits, use 2⁸.', '2⁸=256.'],
          eeUse: 'State count matters for registers, ADC codes, addressing, and protocols.',
        },
      },
      {
        name: 'Graphs and state machines',
        focus: 'Nodes, edges, paths, finite-state machines, and reachability.',
        problem: {
          prompt: 'A finite-state machine has 5 states and each state has 2 outgoing transitions. How many directed transitions are there?',
          answer: '10',
          steps: ['Each of 5 states contributes 2 outgoing transitions.', 'Total transitions = 5*2 = 10.'],
          eeUse: 'Digital controllers, protocols, and embedded workflows are often state machines.',
        },
      },
    ],
  },
  {
    id: 'numerical',
    title: 'Numerical Methods',
    term: 'Computation',
    purpose: 'Root finding, interpolation, numerical integration, ODE solvers, and error.',
    refreshGoal: 'Know what simulation tools are doing and when numerical answers are trustworthy.',
    units: [
      {
        name: 'Root finding',
        focus: 'Bisection, Newton method, convergence, and failure modes.',
        problem: {
          prompt: 'Use one Newton step for f(x)=x²-2 from x₀=1.',
          answer: 'x₁=1.5',
          steps: ['Newton update is x₁=x₀-f(x₀)/f′(x₀).', 'f(1)=-1 and f′(1)=2.', 'x₁=1-(-1/2)=1.5.'],
          eeUse: 'Circuit simulators use iterative nonlinear solving for diodes, transistors, and operating points.',
        },
      },
      {
        name: 'Numerical integration',
        focus: 'Trapezoid rule, Simpson rule, sampling, and error tradeoffs.',
        problem: {
          prompt: 'Use one trapezoid on f(x)=x from 0 to 2.',
          answer: '2',
          steps: ['Trapezoid area is (b-a)(f(a)+f(b))/2.', 'Here width is 2, f(0)=0, f(2)=2.', 'Area = 2*(0+2)/2 = 2.'],
          eeUse: 'Numerical integration supports energy estimates, sampled data, and simulation time stepping.',
        },
      },
      {
        name: 'ODE solvers',
        focus: 'Euler method, step size, stability, and simulation artifacts.',
        problem: {
          prompt: 'Use Euler with h=0.1 for y′=-2y, y₀=1. What is y₁?',
          answer: '0.8',
          steps: ['Euler update is y₁ = y₀ + h·f(t₀,y₀).', 'f=-2y, so f(t₀,1)=-2.', 'y₁=1+0.1(-2)=0.8.'],
          eeUse: 'Time-domain simulators use numerical ODE methods under the hood.',
        },
      },
    ],
  },
  {
    id: 'complex-transforms',
    title: 'Complex Variables and Transforms',
    term: 'Signals bridge',
    purpose: 'Complex numbers, phasors, Fourier series/transforms, Laplace and z-transform intuition.',
    refreshGoal: 'Tie algebra, calculus, and differential equations back into signal and system analysis.',
    units: [
      {
        name: 'Complex arithmetic',
        focus: 'Rectangular/polar forms, magnitude, phase, conjugates, and impedance.',
        problem: {
          prompt: 'Find the magnitude of 3 + j4.',
          answer: '5',
          steps: ['Magnitude is √(real² + imaginary²).', '√(3² + 4²)=√25=5.'],
          eeUse: 'Impedance, phasors, gain, and frequency response use complex numbers constantly.',
        },
      },
      {
        name: 'Fourier thinking',
        focus: 'Sinusoids as basis functions, spectra, bandwidth, and filtering.',
        problem: {
          prompt: 'A pure sinusoid cos(2π·60t) has frequency what?',
          answer: '60 Hz',
          steps: ['Standard form is cos(2πft).', 'Compare 2π·60t with 2πft.', 'f=60 Hz.'],
          eeUse: 'Fourier analysis is the foundation of filters, communications, power quality, and signal processing.',
        },
      },
      {
        name: 'z-transform intuition',
        focus: 'Discrete-time systems, poles, recursion, and sampled signals.',
        problem: {
          prompt: 'For y[n]=0.5y[n-1]+x[n], is the feedback pole stable?',
          answer: 'Yes, the pole magnitude is 0.5 < 1',
          steps: ['The recursive coefficient gives a pole at z=0.5 for this first-order form.', 'Discrete-time stability requires pole magnitude less than 1.', '0.5 is inside the unit circle.'],
          eeUse: 'Digital filters and sampled controllers are governed by z-plane poles.',
        },
      },
    ],
  },
];

export default function MathPage() {
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [unitIdx, setUnitIdx] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);

  const course = COURSES.find(c => c.id === courseId) ?? COURSES[0];
  const unit = course.units[unitIdx] ?? course.units[0];
  const problemKey = `${course.id}:${unit.name}`;
  const doneCount = COURSES.reduce((sum, c) => sum + c.units.filter(u => revealed[`${c.id}:${u.name}`]).length, 0);
  const totalCount = COURSES.reduce((sum, c) => sum + c.units.length, 0);
  const progress = Math.round((doneCount / totalCount) * 100);

  function chooseCourse(nextId: string) {
    setCourseId(nextId);
    setUnitIdx(0);
  }

  function askAi() {
    setChatContext({
      type: 'math',
      topic: `${course.title}: ${unit.name}`,
      front: unit.problem.prompt,
      back: `${unit.problem.answer}. Steps: ${unit.problem.steps.join(' ')}`,
      topicDescription: `${course.purpose} Current focus: ${unit.focus} EE connection: ${unit.problem.eeUse}`,
    });
  }

  return (
    <div style={{ maxWidth: 1220 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div className="page-title">Math Refresh</div>
          <div className="page-sub">EE math rebuilt from Calculus I through differential equations, linear systems, probability, and transforms</div>
        </div>
        <div className="card" style={{ padding: '10px 13px', minWidth: 132, textAlign: 'right' }}>
          <div style={{ color: 'var(--sky)', fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{progress}%</div>
          <div style={{ color: 'var(--tx-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Problems opened</div>
        </div>
      </div>

      <section className="card-sheen" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {COURSES.map((c, i) => {
            const active = c.id === course.id;
            const complete = c.units.filter(u => revealed[`${c.id}:${u.name}`]).length;
            return (
              <button
                key={c.id}
                onClick={() => chooseCourse(c.id)}
                style={{
                  padding: '11px 12px',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  alignItems: 'flex-start',
                  background: active ? 'var(--a-dim)' : 'var(--s1)',
                  border: `1px solid ${active ? 'rgba(34,211,238,0.32)' : 'var(--bd)'}`,
                  borderRadius: 9,
                  color: 'var(--tx)',
                }}
              >
                <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--a)' : 'var(--s3)', color: active ? '#fff' : 'var(--tx-2)', fontSize: 11, fontWeight: 850 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, lineHeight: 1.25 }}>{c.title}</span>
                  <span style={{ display: 'block', color: 'var(--tx-3)', fontSize: 10.5, lineHeight: 1.35, marginTop: 3 }}>{complete}/{c.units.length} reviewed</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <section className="card" style={{ padding: 14 }}>
          <div style={{ color: 'var(--sky)', fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{course.term}</div>
          <div style={{ color: 'var(--tx)', fontSize: 20, fontWeight: 850, lineHeight: 1.15 }}>{course.title}</div>
          <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.5, marginTop: 8 }}>{course.purpose}</div>
          <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 9, padding: 11, color: 'var(--tx-2)', fontSize: 12, lineHeight: 1.45, marginTop: 12 }}>
            {course.refreshGoal}
          </div>

          <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, margin: '16px 0 8px' }}>
            Units
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {course.units.map((u, i) => {
              const active = i === unitIdx;
              const seen = !!revealed[`${course.id}:${u.name}`];
              return (
                <button
                  key={u.name}
                  onClick={() => setUnitIdx(i)}
                  style={{
                    padding: '10px 11px',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    background: active ? 'var(--sky-d)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(56,189,248,0.26)' : 'var(--bd)'}`,
                    borderRadius: 9,
                    color: 'var(--tx)',
                  }}
                >
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 750, lineHeight: 1.3 }}>{u.name}</span>
                    <span style={{ display: 'block', color: 'var(--tx-3)', fontSize: 11, lineHeight: 1.35, marginTop: 3 }}>{u.focus}</span>
                  </span>
                  {seen && <span style={{ color: 'var(--green)', fontWeight: 900, flexShrink: 0 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ color: 'var(--sky)', fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{course.title}</div>
              <div style={{ color: 'var(--tx)', fontSize: 21, fontWeight: 850, lineHeight: 1.18 }}>{unit.name}</div>
              <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.55, marginTop: 5 }}>{unit.focus}</div>
            </div>
            <button className="btn-ghost" onClick={askAi} style={{ padding: '8px 13px' }}>
              Ask AI
            </button>
          </div>

          <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 8 }}>
              Practice problem
            </div>
            <div style={{ color: 'var(--tx)', fontSize: 17, fontWeight: 700, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
              <MathText text={unit.problem.prompt} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <button
              className="btn-primary"
              onClick={() => setRevealed(r => ({ ...r, [problemKey]: true }))}
              style={{ padding: '9px 15px' }}
            >
              Show solution
            </button>
            <button
              className="btn-ghost"
              onClick={askAi}
              style={{ padding: '9px 15px' }}
            >
              Ask about this problem
            </button>
          </div>

          {revealed[problemKey] ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ background: 'var(--green-d)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ color: 'var(--green)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 850, marginBottom: 4 }}>Answer</div>
                <div style={{ color: 'var(--tx)', fontSize: 16, fontWeight: 800, lineHeight: 1.45 }}>
                  <MathText text={unit.problem.answer} />
                </div>
              </div>

              <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: 14 }}>
                <div style={{ color: 'var(--tx-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 850, marginBottom: 8 }}>Steps</div>
                <div style={{ display: 'grid', gap: 7 }}>
                  {unit.problem.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', color: 'var(--tx-2)', fontSize: 13, lineHeight: 1.45 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--s3)', color: 'var(--sky)', fontSize: 10.5, fontWeight: 850 }}>{i + 1}</span>
                      <span><MathText text={step} /></span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--sky-d)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 10, padding: '12px 14px', color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--sky)', fontWeight: 850 }}>EE connection: </span>
                {unit.problem.eeUse}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--s1)', border: '1px dashed var(--bd-md)', borderRadius: 10, padding: 16, color: 'var(--tx-3)', fontSize: 12.5, lineHeight: 1.5 }}>
              Try the problem first, then reveal the solution. Use Ask AI when you want a slower walkthrough, a similar problem, or a reminder of the prerequisite concept.
            </div>
          )}
        </section>
      </div>

      {chatContext && (
        <AiChat
          context={chatContext}
          onClose={() => setChatContext(null)}
          greeting={`I can help with ${unit.name}. Ask for a step-by-step walkthrough, a prerequisite refresher, or a similar EE-flavored practice problem.`}
        />
      )}
    </div>
  );
}
