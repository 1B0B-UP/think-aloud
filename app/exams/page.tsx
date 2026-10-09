'use client';

import { useState } from 'react';
import MathText from '@/components/MathText';
import AiChat from '@/components/AiChat';
import { AnswerChoice, Button, ButtonLink, PageHeader, Panel, ReviewPanel } from '@/components/ui';
import type { ChatContext } from '@/app/api/chat/route';
import { answersMatch, resolveCorrectAnswer } from '@/lib/quizMatch';

type ExamId = 'fe-electrical' | 'pe-power';
type SectionConfidence = 'weak' | 'review' | 'ready';

interface Question {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  formulaHint: string;
  steps: string[];
  optionFeedback: Record<string, string>;
  trap: string;
  handbookHint?: string;
}

interface ExamSection {
  name: string;
  weight: string;
  questionRange?: [number, number];
  handbookBuckets?: string[];
  priorityNote?: string;
  focus: string;
  sample: Question;
}

interface ExamPlan {
  id: ExamId;
  title: string;
  subtitle: string;
  sourceLabel: string;
  sourceUrl: string;
  sections: ExamSection[];
}

interface FormulaSection {
  name: string;
  handbookTarget: string;
  formulas: string[];
  drill: string;
}

const LOCAL_FE_HANDBOOK_URL = '/fe-handbook-10-6.pdf';

function rangeTotal(range?: [number, number]): number {
  return range ? range[0] + range[1] : 0;
}

function rangeMidpoint(range?: [number, number]): number {
  return range ? (range[0] + range[1]) / 2 : 0;
}

function rangeLabel(range?: [number, number]): string {
  return range ? `${range[0]}-${range[1]} questions` : 'Practice priority';
}

function priorityTone(range?: [number, number]): { label: string; color: string; bg: string; border: string } {
  const high = range?.[1] ?? 0;
  if (high >= 18) return { label: 'Highest yield', color: 'var(--a-light)', bg: 'var(--a-dim)', border: 'rgba(34,211,238,0.28)' };
  if (high >= 16) return { label: 'High yield', color: 'var(--sky)', bg: 'var(--sky-d)', border: 'rgba(56,189,248,0.24)' };
  if (high >= 11) return { label: 'Important', color: 'var(--green)', bg: 'var(--green-d)', border: 'rgba(34,197,94,0.22)' };
  return { label: 'Support', color: 'var(--tx-2)', bg: 'rgba(255,255,255,0.04)', border: 'var(--bd)' };
}

function confidenceLabel(value?: SectionConfidence): string {
  if (value === 'ready') return 'Ready';
  if (value === 'review') return 'Review';
  return 'Weak';
}

function confidenceScore(value?: SectionConfidence): number {
  if (value === 'ready') return 1;
  if (value === 'review') return 0.55;
  return 0.15;
}

const FE_FORMULA_SECTIONS: FormulaSection[] = [
  {
    name: 'Math and calculus',
    handbookTarget: 'Offline quick reference for algebra, calculus, transforms, numerical methods, and units.',
    formulas: ['[[d(xⁿ)|dx]] = nxⁿ⁻¹', '[[d(eᵃˣ)|dx]] = aeᵃˣ', '[[d(ln x)|dx]] = [[1|x]]', '∫xⁿ dx = [[xⁿ⁺¹|n+1]]+C', '∫eᵃˣ dx = [[eᵃˣ|a]] + C', '∫sin ax dx = [[-cos ax|a]] + C', '∫cos ax dx = [[sin ax|a]] + C', 'Taylor: f(x) ≈ f(a)+f′(a)(x-a)+...', 'Newton: xₙ₊₁=xₙ-[[f(xₙ)|f′(xₙ)]]', '1 in = 25.4 mm'],
    drill: 'Find the derivative/integral table first, then solve without hunting through unrelated sections.',
  },
  {
    name: 'Probability and statistics',
    handbookTarget: 'Offline quick reference for probability, distributions, estimation, and measurement data.',
    formulas: ['σ = √variance', 'z = [[x-μ|σ]]', 'E[aX+b] = aE[X]+b', 'Var(aX+b)=a²Var(X)', 'Normal: f(x)=[[1|σ√2π]]e⁻(ˣ⁻μ)²/(²σ²)', 'Binomial: P(X=k)=C(n,k)pᵏ(1-p)ⁿ⁻ᵏ', 'Poisson: P(X=k)=[[e⁻λ λᵏ|k!]]', 'Sample mean: x̄=[[Σxᵢ|n]]', 's²=[[Σ(xᵢ-x̄)²|n-1]]'],
    drill: 'Identify the distribution before touching a calculator.',
  },
  {
    name: 'Circuits',
    handbookTarget: 'Offline quick reference for circuit laws, impedance, power, and transients.',
    formulas: ['V = IR', 'P = VI = I²R = [[V²|R]]', 'KCL: ΣI = 0', 'KVL: ΣV = 0', 'ZL = jωL', 'ZC = [[1|jωC]]', 'XC = [[1|2πfC]]', 'XL = 2πfL', 'τRC = RC', 'τRL = [[L|R]]', 'vC(t)=Vf+(Vi−Vf)e⁻ᵗ/τ', 'Req series = ΣR', '[[1|Req]] parallel = Σ([[1|R]])'],
    drill: 'Decide whether the problem is DC, phasor AC, transient, or power before choosing a formula.',
  },
  {
    name: 'Signals and systems',
    handbookTarget: 'Offline quick reference for Fourier, Laplace, z-transform, transfer functions, and filters.',
    formulas: ['H(s)=[[Y(s)|X(s)]]', 'ω = 2πf', 'L{1}=[[1|s]]', 'L{e⁻ᵃᵗ}=[[1|s+a]]', 'L{sin ωt}=[[ω|s²+ω²]]', 'L{cos ωt}=[[s|s²+ω²]]', 'Convolution: y(t)=x(t)*h(t)', 'Stable CT poles: Re{s}<0', 'Stable DT poles: |z|<1', 'First-order cutoff: fc=[[1|2πτ]]'],
    drill: 'Translate the problem into time domain, s-domain, or frequency domain first.',
  },
  {
    name: 'Electronics',
    handbookTarget: 'Offline quick reference for op-amps, diodes, transistors, logic, and small-signal shortcuts.',
    formulas: ['Ideal inverting op-amp: Av = -[[Rf|Rin]]', 'Ideal non-inverting op-amp: Av = 1+[[Rf|Rg]]', 'Vout integrator = -[[1|RC]]∫Vin dt', 'Vout differentiator = -RC [[dVin|dt]]', 'Diode: i≈Is(eᵛ/ⁿⱽᵀ−1)', 'BJT: IC≈βIB', 'MOSFET sat: ID≈[[k(VGS−VT)²|2]]', 'Logic: ¬(A∧B)=¬A∨¬B', 'P = VI'],
    drill: 'Check ideal assumptions before applying an op-amp or semiconductor shortcut.',
  },
  {
    name: 'Power and electromagnetics',
    handbookTarget: 'Offline quick reference for three-phase power, phasors, fields, and magnetic circuits.',
    formulas: ['P1φ = VrmsIrms pf', 'P3φ = √3 VL IL pf', 'S = P + jQ', '|S| = VrmsIrms', 'pf = cos θ', 'Q = VrmsIrms sin θ', 'η = [[Pout|Pin]]', 'E = [[V|d]]', 'F = qE', 'B = μH', 'Φ = BA', 'Faraday: v = N [[dΦ|dt]]'],
    drill: 'Label line vs phase values before calculating three-phase power.',
  },
  {
    name: 'Controls',
    handbookTarget: 'Offline quick reference for block diagrams, feedback, second-order form, and stability.',
    formulas: ['Closed-loop: T = [[G|1+GH]]', 'Unity feedback: T = [[G|1+G]]', 'Standard 2nd order: [[ωn²|s²+2ζωn s+ωn²]]', 'PO ≈ 100e⁻ζπ/√(¹⁻ζ²)%', 'Ts(2%) ≈ [[4|ζωn]]', 'Tp = [[π|ωn√(1−ζ²)]]', 'ess step = [[1|1+Kp]]', 'ess ramp = [[1|Kv]]'],
    drill: 'Put the transfer function into standard form before reading damping or natural frequency.',
  },
];

const EXAMS: ExamPlan[] = [
  {
    id: 'fe-electrical',
    title: 'FE Electrical & Computer',
    subtitle: 'Fundamentals review organized around the NCEES FE Electrical and Computer specification areas.',
    sourceLabel: 'NCEES FE exam information',
    sourceUrl: 'https://ncees.org/exams/fe-exam/',
    sections: [
      {
        name: 'Mathematics',
        weight: 'Core',
        questionRange: [11, 17],
        handbookBuckets: ['Mathematics'],
        priorityNote: 'Large standalone section. Keep calculus, complex numbers, linear algebra, and Laplace lookup fast.',
        focus: 'Algebra, calculus, differential equations, transforms, and numerical methods.',
        sample: {
          prompt: 'Using the handbook Laplace table, which time-domain function corresponds to F(s)=1/(s+4)?',
          options: ['e^(-4t)u(t)', '4e^(-t)u(t)', 'u(t-4)', 'sin(4t)u(t)'],
          answer: 'e^(-4t)u(t)',
          explanation: 'The unilateral Laplace transform pair in the handbook lists e^(-at)u(t) ↔ 1/(s+a). With a=4, the inverse is e^(-4t)u(t).',
          formulaHint: 'Laplace pair: e^(-at)u(t) ↔ [[1|s+a]].',
          steps: ['Go to the Laplace transform table.', 'Match the denominator s+4 to s+a.', 'Set a=4.', 'Write the inverse as e^(-4t)u(t).'],
          optionFeedback: {
            'e^(-4t)u(t)': 'Correct. This directly matches 1/(s+a) with a=4.',
            '4e^(-t)u(t)': 'This would place the pole at -1 and scale the numerator; it does not match s+4.',
            'u(t-4)': 'A shifted step is not represented by 1/(s+4).',
            'sin(4t)u(t)': 'The sine pair has a quadratic denominator s^2+omega^2, not s+4.',
          },
          trap: 'Do not treat the +4 as a time delay or a numerator scale; it is the exponential decay constant.',
          handbookHint: 'FE Handbook 10.6: Mathematics section, Laplace transforms table.',
        },
      },
      {
        name: 'Probability and Statistics',
        weight: 'Core',
        questionRange: [4, 6],
        handbookBuckets: ['Probability and Statistics'],
        priorityNote: 'Lower count, but quick points if you can identify distributions and table entries.',
        focus: 'Expected value, variance, probability distributions, estimation, and data interpretation.',
        sample: {
          prompt: 'A binomial process has n=20 trials and success probability p=0.30. Using the handbook probability table, what is the variance?',
          options: ['4.2', '6.0', '14.0', '0.21'],
          answer: '4.2',
          explanation: 'For a binomial random variable, the handbook lists variance = np(1-p). Substituting n=20 and p=0.30 gives 20*0.30*0.70 = 4.2.',
          formulaHint: 'Binomial variance: σ² = np(1-p).',
          steps: ['Identify the distribution as binomial.', 'Use p=0.30 and q=1-p=0.70.', 'Compute npq = 20*0.30*0.70.', 'The variance is 4.2.'],
          optionFeedback: {
            '4.2': 'Correct. This uses np(1-p).',
            '6.0': 'This is the expected value np, not the variance.',
            '14.0': 'This uses n(1-p) and omits p.',
            '0.21': 'This uses p(1-p) but omits the number of trials.',
          },
          trap: 'Expected value and variance are adjacent in the handbook table; do not stop at np.',
          handbookHint: 'FE Handbook 10.6: Engineering Probability and Statistics, probability/density functions table.',
        },
      },
      {
        name: 'Ethics and Professional Practice',
        weight: 'Core',
        questionRange: [4, 6],
        handbookBuckets: ['Ethics and Professional Practice'],
        priorityNote: 'Short section. Prioritize public safety, professional duty, IP, and safety wording.',
        focus: 'Public safety, professional responsibility, conflicts of interest, and licensure duties.',
        sample: {
          prompt: 'If an engineer finds a safety-critical design error after release, the first obligation is to:',
          options: ['Protect public safety', 'Avoid project delay', 'Protect company reputation', 'Wait for the next review'],
          answer: 'Protect public safety',
          explanation: 'Licensure ethics place public health, safety, and welfare first.',
          formulaHint: 'Ethics priority: public health, safety, and welfare come first.',
          steps: ['Identify that the issue is safety-critical.', 'Rank obligations: public safety outranks schedule and reputation.', 'Choose the action that addresses risk immediately.'],
          optionFeedback: {
            'Protect public safety': 'Correct. Public safety is the controlling obligation.',
            'Avoid project delay': 'Schedule matters, but it cannot override a known safety-critical issue.',
            'Protect company reputation': 'Reputation is secondary to public welfare and disclosure of safety risks.',
            'Wait for the next review': 'Waiting can leave a known hazard unaddressed.',
          },
          trap: 'Ethics questions often include business-pressure distractors; choose the public-welfare answer.',
          handbookHint: 'Review ethics and professional practice guidance.',
        },
      },
      {
        name: 'Circuit Analysis',
        weight: 'High',
        questionRange: [11, 17],
        handbookBuckets: ['Circuit Analysis'],
        priorityNote: 'One of the biggest FE Electrical buckets. Drill Thevenin/Norton, phasors, impedance, and RMS.',
        focus: 'KCL/KVL, Thevenin/Norton equivalents, transient response, AC steady state, and power.',
        sample: {
          prompt: 'A network has a Thévenin equivalent of Vth=12 V and Rth=4 ohm. What load resistance receives maximum power?',
          options: ['4 ohm', '3 ohm', '8 ohm', '12 ohm'],
          answer: '4 ohm',
          explanation: 'The handbook maximum power-transfer theorem states that a dc load receives maximum power when RL equals the Thévenin resistance. Here RL=Rth=4 ohm.',
          formulaHint: 'DC maximum power transfer: RL = RTh.',
          steps: ['Recognize the circuit is already in Thévenin form.', 'Find Rth=4 ohm.', 'Use the dc maximum power-transfer condition RL=Rth.', 'Select 4 ohm.'],
          optionFeedback: {
            '4 ohm': 'Correct. Match the load to Rth for maximum dc power transfer.',
            '3 ohm': 'This may come from using V/R, but the load match is set by resistance, not current.',
            '8 ohm': 'This doubles Rth; maximum power requires equality.',
            '12 ohm': 'This uses the voltage number as a resistance.',
          },
          trap: 'The voltage source value does not set the matching load; Rth does.',
          handbookHint: 'FE Handbook 10.6: Electrical and Computer Engineering, DC circuits maximum power-transfer theorem.',
        },
      },
      {
        name: 'Linear Systems and Signal Processing',
        weight: 'High',
        questionRange: [10, 16],
        handbookBuckets: ['Linear Systems', 'Signal Processing'],
        priorityNote: 'Combined high-yield bucket. Practice transform lookup, transfer functions, filters, and sampling.',
        focus: 'Convolution, transfer functions, frequency response, filters, sampling, and transforms.',
        sample: {
          prompt: 'A low-pass message has bandwidth W=3 kHz. According to the handbook sampling theorem, what minimum sampling frequency avoids aliasing?',
          options: ['Greater than 6 kHz', 'Exactly 3 kHz', 'Greater than 1.5 kHz', 'Exactly 9 kHz'],
          answer: 'Greater than 6 kHz',
          explanation: 'The handbook states that a low-pass message can be reconstructed from uniformly spaced samples when fs > 2W. With W=3 kHz, fs must be greater than 6 kHz.',
          formulaHint: 'Nyquist sampling condition: fs > 2W.',
          steps: ['Identify W=3 kHz as the message bandwidth.', 'Use the sampling theorem condition fs > 2W.', 'Compute 2W = 6 kHz.', 'Choose a sampling rate greater than 6 kHz.'],
          optionFeedback: {
            'Greater than 6 kHz': 'Correct. The handbook uses a strict greater-than condition.',
            'Exactly 3 kHz': 'This samples at the message bandwidth, not twice the bandwidth.',
            'Greater than 1.5 kHz': 'This halves the bandwidth instead of doubling it.',
            'Exactly 9 kHz': '9 kHz would work, but it is not the minimum threshold asked for.',
          },
          trap: 'The threshold is greater than 2W, not equal to W.',
          handbookHint: 'FE Handbook 10.6: Signal processing, sampled messages and Nyquist theorem.',
        },
      },
      {
        name: 'Electronics',
        weight: 'High',
        questionRange: [7, 11],
        handbookBuckets: ['Electronics'],
        priorityNote: 'Medium-high yield. Focus ideal op amps, device operating regions, and converter formulas.',
        focus: 'Diodes, BJTs, MOSFETs, op-amps, biasing, logic families, and small-signal behavior.',
        sample: {
          prompt: 'In an ideal op amp operating linearly with negative feedback, the noninverting input is held at 2.0 V. What is the inverting input voltage?',
          options: ['2.0 V', '0 V', '-2.0 V', 'Undefined because A is large'],
          answer: '2.0 V',
          explanation: 'The handbook ideal op-amp model assumes very large open-loop gain and linear operation, so the differential input voltage is approximately zero: v1 ≈ v2.',
          formulaHint: 'Ideal op amp in linear feedback: v+ ≈ v-.',
          steps: ['Confirm the op amp is ideal and operating linearly.', 'Use the virtual short assumption from the equivalent model.', 'Set v- equal to v+.', 'v- = 2.0 V.'],
          optionFeedback: {
            '2.0 V': 'Correct. Negative feedback drives the input difference close to zero.',
            '0 V': 'This would only be true if the noninverting input were grounded.',
            '-2.0 V': 'The inverting input is not the negative of the noninverting input under linear feedback.',
            'Undefined because A is large': 'Large gain is what makes the virtual-short approximation useful in linear operation.',
          },
          trap: 'Do not confuse "inverting input" with "negative voltage"; it is a terminal name.',
          handbookHint: 'FE Handbook 10.6: Electronics, equivalent circuit of an ideal op amp.',
        },
      },
      {
        name: 'Power and Electromagnetics',
        weight: 'High',
        questionRange: [12, 18],
        handbookBuckets: ['Power Systems', 'Electromagnetics'],
        priorityNote: 'Highest practical EE bucket after computing/software. Include three-phase power, transformers, motors, fields, and transmission lines.',
        focus: 'Three-phase power, transformers, motors, fields, transmission lines, and magnetic circuits.',
        sample: {
          prompt: 'An ideal transformer has Np/Ns=4 and an 8 ohm load connected to the secondary. What impedance is reflected to the primary?',
          options: ['128 ohm', '32 ohm', '2 ohm', '8 ohm'],
          answer: '128 ohm',
          explanation: 'The handbook transformer relation gives the input/reflected impedance as Zp=a^2 Zs, where a=Np/Ns. With a=4 and Zs=8 ohm, Zp=16*8=128 ohm.',
          formulaHint: 'Ideal transformer reflected impedance: Zp = a²Zs, a = Np/Ns.',
          steps: ['Identify the turns ratio a=Np/Ns=4.', 'Square the ratio: a²=16.', 'Multiply by the secondary load: 16*8 ohm.', 'Zp=128 ohm.'],
          optionFeedback: {
            '128 ohm': 'Correct. Reflected impedance scales by the square of the turns ratio.',
            '32 ohm': 'This multiplies by a instead of a².',
            '2 ohm': 'This divides by a instead of multiplying by a².',
            '8 ohm': 'This ignores the transformer turns ratio.',
          },
          trap: 'Voltage and current ratios scale by a, but impedance scales by a².',
          handbookHint: 'FE Handbook 10.6: Electrical and Computer Engineering, ideal transformers.',
        },
      },
      {
        name: 'Computer Networks and Software',
        weight: 'Medium',
        questionRange: [21, 32],
        handbookBuckets: ['Computer Networks', 'Digital Systems', 'Computer Systems', 'Software Engineering'],
        priorityNote: 'Biggest combined app bucket. Digital systems alone is 8-12 questions, with networks, computer systems, and software adding more.',
        focus: 'Data structures, algorithms, networking, protocols, digital systems, and computer architecture.',
        sample: {
          prompt: 'The handbook algorithm table lists the average runtime of quick sort as:',
          options: ['O(n log n)', 'O(n^2)', 'O(log n)', 'O(1)'],
          answer: 'O(n log n)',
          explanation: 'The software section table lists quick sort average performance as O(n log n), with O(n^2) as the worst case.',
          formulaHint: 'Quick sort: average O(n log n), worst O(n²).',
          steps: ['Go to the software/algorithm table.', 'Find quick sort.', 'Read the average column, not the worst column.', 'Select O(n log n).'],
          optionFeedback: {
            'O(n log n)': 'Correct. That is the average quick sort entry.',
            'O(n^2)': 'This is quick sort worst case, not average case.',
            'O(log n)': 'This is closer to a balanced tree lookup, not a full sort.',
            'O(1)': 'Constant time is associated with average hash-table access, not sorting.',
          },
          trap: 'The table has separate average and worst columns; read the column the question asks for.',
          handbookHint: 'FE Handbook 10.6: Software engineering, algorithm complexity table.',
        },
      },
      {
        name: 'Instrumentation and Control',
        weight: 'Medium',
        questionRange: [6, 9],
        handbookBuckets: ['Control Systems', 'Instrumentation topics inside Electronics'],
        priorityNote: 'Control systems is a dedicated 6-9 question bucket; instrumentation also appears inside Electronics.',
        focus: 'Transducers, signal conditioning, measurement error, sampling, and control-system interpretation.',
        sample: {
          prompt: 'The handbook defines transducer sensitivity as the ratio of change in electrical signal magnitude to:',
          options: ['Change in the measured physical parameter', 'Supply voltage', 'Sensor package mass', 'ADC word length'],
          answer: 'Change in the measured physical parameter',
          explanation: 'In the instrumentation section, transducer sensitivity is defined as the ratio of output electrical signal change to the change in the physical parameter being measured.',
          formulaHint: 'Sensitivity = Δelectrical signal / Δphysical parameter.',
          steps: ['Identify that the device is a transducer/sensor.', 'Look up the instrumentation definition of sensitivity.', 'Sensitivity compares output change to input physical change.', 'Choose change in the measured physical parameter.'],
          optionFeedback: {
            'Change in the measured physical parameter': 'Correct. Sensitivity is an output-change over input-change ratio.',
            'Supply voltage': 'Supply voltage may affect operation, but it is not the denominator in the sensitivity definition.',
            'Sensor package mass': 'Package mass is usually not part of the sensitivity definition.',
            'ADC word length': 'ADC word length affects digitization resolution, not transducer sensitivity.',
          },
          trap: 'Do not confuse sensor sensitivity with digital resolution or supply requirements.',
          handbookHint: 'FE Handbook 10.6: Instrumentation, Measurement, and Control, transducer sensitivity.',
        },
      },
    ],
  },
  {
    id: 'pe-power',
    title: 'PE Electrical and Computer: Power',
    subtitle: 'Professional practice review organized around power engineering design, protection, codes, and analysis.',
    sourceLabel: 'NCEES PE exam information',
    sourceUrl: 'https://ncees.org/exams/pe-exam/',
    sections: [
      {
        name: 'General Power Engineering',
        weight: 'Core',
        questionRange: [8, 12],
        handbookBuckets: ['General Applications'],
        priorityNote: 'High value for PE Power. Practice grounding, demand, surge/lightning protection, energy management, and applied code lookup.',
        focus: 'Per-unit calculations, complex power, power factor, grounding, safety, and engineering economics.',
        sample: {
          prompt: 'A 100 kVA transformer supplies a 75 kW load at 0.75 power factor. The apparent power used is:',
          options: ['100 kVA', '75 kVA', '56.25 kVA', '133 kVA'],
          answer: '100 kVA',
          explanation: 'S=P/pf=75/0.75=100 kVA.',
          formulaHint: 'Apparent power: S = P/pf.',
          steps: ['Identify real power P=75 kW and power factor=0.75.', 'Use S=P/pf.', 'Compute 75/0.75=100 kVA.'],
          optionFeedback: {
            '100 kVA': 'Correct. Apparent power is real power divided by power factor.',
            '75 kVA': 'This treats real power and apparent power as equal, which only happens at unity power factor.',
            '56.25 kVA': 'This multiplies by power factor instead of dividing.',
            '133 kVA': 'This appears to invert the power factor relationship incorrectly.',
          },
          trap: 'When pf<1, apparent power is larger than real power.',
          handbookHint: 'Use power triangle and apparent power relationships.',
        },
      },
      {
        name: 'Circuits and Analysis',
        weight: 'Core',
        questionRange: [10, 15],
        handbookBuckets: ['Circuit Analysis'],
        priorityNote: 'One of the highest-yield PE buckets. Own per-unit, symmetrical components, phasors, three-phase circuits, and fault setup.',
        focus: 'Fault current, symmetrical components, voltage drop, harmonics, and short-circuit studies.',
        sample: {
          prompt: 'A bolted three-phase fault is generally analyzed first using:',
          options: ['Positive-sequence network only', 'Negative-sequence only', 'Zero-sequence only', 'Open-circuit voltage only'],
          answer: 'Positive-sequence network only',
          explanation: 'A balanced three-phase fault uses the positive-sequence network for the initial symmetrical fault calculation.',
          formulaHint: 'Balanced three-phase faults use the positive-sequence network.',
          steps: ['Classify the fault as balanced three-phase.', 'Balanced faults do not require negative- or zero-sequence networks for the initial symmetrical calculation.', 'Use the positive-sequence network.'],
          optionFeedback: {
            'Positive-sequence network only': 'Correct. A balanced three-phase fault is represented by the positive-sequence network.',
            'Negative-sequence only': 'Negative sequence is used for unbalanced conditions.',
            'Zero-sequence only': 'Zero sequence is used when ground-return paths are involved in unbalanced faults.',
            'Open-circuit voltage only': 'Open-circuit voltage may be a source term, but not the network model by itself.',
          },
          trap: 'Do not apply all sequence networks automatically; classify the fault first.',
          handbookHint: 'Use symmetrical components/fault analysis references.',
        },
      },
      {
        name: 'Rotating Machines and Transformers',
        weight: 'High',
        questionRange: [13, 20],
        handbookBuckets: ['Rotating Machines', 'Electric Power Devices'],
        priorityNote: 'Combined app section covering two PE buckets. Prioritize transformer connections, capacitors, storage/PV/wind, motor starting, and machine applications.',
        focus: 'Induction motors, synchronous machines, transformer equivalent circuits, losses, and ratings.',
        sample: {
          prompt: 'Transformer copper loss varies primarily with:',
          options: ['Current squared', 'Voltage squared', 'Frequency only', 'Core flux only'],
          answer: 'Current squared',
          explanation: 'Copper loss is I²R winding loss, so it varies with the square of load current.',
          formulaHint: 'Copper loss: Pcu = I²R.',
          steps: ['Copper loss is resistive winding loss.', 'Resistive loss follows I²R.', 'Therefore it varies with current squared.'],
          optionFeedback: {
            'Current squared': 'Correct. Winding copper loss is I²R.',
            'Voltage squared': 'Voltage can influence current, but copper loss is directly tied to current squared.',
            'Frequency only': 'Frequency affects core losses more directly than copper loss.',
            'Core flux only': 'Core flux relates to core loss, not winding copper loss.',
          },
          trap: 'Separate copper loss from core loss.',
          handbookHint: 'Use transformer loss and equivalent circuit references.',
        },
      },
      {
        name: 'Transmission and Distribution',
        weight: 'High',
        questionRange: [8, 12],
        handbookBuckets: ['Transmission and Distribution Analysis'],
        priorityNote: 'High-value PE section. Drill voltage drop/regulation, power factor correction, transformer connections, power flow, and stability.',
        focus: 'Feeders, substations, conductors, voltage regulation, capacitors, and load flow.',
        sample: {
          prompt: 'Installing shunt capacitors on a distribution feeder is commonly used to improve:',
          options: ['Power factor', 'Conductor tensile strength', 'Fault clearing time only', 'Insulation class'],
          answer: 'Power factor',
          explanation: 'Shunt capacitors supply reactive power locally, improving power factor and voltage profile.',
          formulaHint: 'Capacitors supply leading reactive power.',
          steps: ['Identify the device: shunt capacitor.', 'Capacitors provide local reactive power support.', 'Local reactive support reduces reactive demand from upstream sources.', 'This improves power factor and often voltage profile.'],
          optionFeedback: {
            'Power factor': 'Correct. Shunt capacitors are a standard power-factor correction tool.',
            'Conductor tensile strength': 'Mechanical conductor strength is not changed by capacitors.',
            'Fault clearing time only': 'Protection timing is not the primary purpose of shunt capacitors.',
            'Insulation class': 'Insulation class is a thermal/equipment rating, not corrected by capacitors.',
          },
          trap: 'Shunt capacitors are about reactive power, not mechanical or insulation properties.',
          handbookHint: 'Use power factor correction and reactive power references.',
        },
      },
      {
        name: 'Protection',
        weight: 'High',
        questionRange: [10, 15],
        handbookBuckets: ['Protection'],
        priorityNote: 'One of the most important PE sections. Practice coordination, overcurrent protection, breaker/fuse/recloser behavior, and relay selection.',
        focus: 'Relays, coordination, breakers, fuses, instrument transformers, and protective zones.',
        sample: {
          prompt: 'The primary purpose of relay coordination is to:',
          options: ['Isolate only the faulted section', 'Trip all upstream devices', 'Increase load current', 'Eliminate grounding'],
          answer: 'Isolate only the faulted section',
          explanation: 'Coordination aims for selective isolation so the nearest protective device clears the fault first.',
          formulaHint: 'Protection coordination goal: selectivity.',
          steps: ['Identify the purpose of coordination.', 'The nearest appropriate protective device should operate first.', 'Upstream devices should remain closed unless backup protection is needed.', 'Therefore only the faulted section should be isolated.'],
          optionFeedback: {
            'Isolate only the faulted section': 'Correct. This is selective coordination.',
            'Trip all upstream devices': 'That would unnecessarily expand the outage.',
            'Increase load current': 'Protection does not aim to increase load current.',
            'Eliminate grounding': 'Grounding is a safety and fault-current control topic, not the goal of coordination.',
          },
          trap: 'Coordination is about selective tripping, not maximum tripping.',
          handbookHint: 'Use protective device coordination references.',
        },
      },
      {
        name: 'Electrical Safety and Codes',
        weight: 'High',
        questionRange: [10, 15],
        handbookBuckets: ['Electrical Safety', 'Codes and Standards'],
        priorityNote: 'Highest-yield PE category. You need fast navigation through NEC, NFPA 70E, NESC, hazardous locations, wiring methods, and shock/burn hazards.',
        focus: 'NEC, NESC, NFPA 70E, grounding, working clearances, conductor sizing, and safety rules.',
        sample: {
          prompt: 'For exam practice, code questions should be approached by first identifying:',
          options: ['The applicable article/table', 'The longest calculation path', 'The manufacturer brand', 'The oldest standard edition'],
          answer: 'The applicable article/table',
          explanation: 'Code problems are reference-navigation problems first: identify the governing article, condition, and table.',
          formulaHint: 'Code method: identify scope, condition, article/table, then calculate.',
          steps: ['Read what equipment or installation condition is being asked about.', 'Find the governing article or table.', 'Confirm conditions and exceptions before calculating.', 'Then apply the table value or rule.'],
          optionFeedback: {
            'The applicable article/table': 'Correct. Code questions start with finding the governing reference.',
            'The longest calculation path': 'Long calculations are not the goal; correct reference selection is.',
            'The manufacturer brand': 'Brand is usually irrelevant unless the problem gives equipment-specific data.',
            'The oldest standard edition': 'Use the applicable exam/reference edition, not the oldest standard.',
          },
          trap: 'For code questions, navigation and scope usually matter before arithmetic.',
          handbookHint: 'Use the code/standards reference material available for your exam.',
        },
      },
      {
        name: 'Measurement and Instrumentation',
        weight: 'Medium',
        questionRange: [6, 9],
        handbookBuckets: ['Measurement and Instrumentation'],
        priorityNote: 'Moderate PE yield. Focus instrument transformers, metering, insulation testing, and ground resistance testing.',
        focus: 'Instrument transformers, metering, insulation testing, and ground resistance testing.',
        sample: {
          prompt: 'A current transformer is primarily used in power metering to:',
          options: ['Step high current down to a measurable secondary current', 'Raise system voltage for transmission', 'Correct power factor directly', 'Interrupt fault current'],
          answer: 'Step high current down to a measurable secondary current',
          explanation: 'Instrument transformers scale high system quantities into safer, measurable values for meters and relays.',
          formulaHint: 'CT purpose: scale current for metering/protection inputs.',
          steps: ['Identify CT as a current transformer.', 'Recall it is an instrument transformer.', 'Instrument transformers feed meters/relays with scaled values.', 'Choose the option that scales high current down.'],
          optionFeedback: {
            'Step high current down to a measurable secondary current': 'Correct. That is the core CT metering/protection purpose.',
            'Raise system voltage for transmission': 'That describes a power transformer, not a CT.',
            'Correct power factor directly': 'Capacitors or compensation equipment address power factor.',
            'Interrupt fault current': 'Breakers, fuses, and reclosers interrupt current; CTs measure it.',
          },
          trap: 'Do not confuse an instrument transformer with a power transformer or interrupting device.',
          handbookHint: 'PE Power spec: Measurement and Instrumentation, instrument transformers and metering.',
        },
      },
      {
        name: 'Power Electronics and Control Devices',
        weight: 'Medium',
        questionRange: [5, 8],
        handbookBuckets: ['Power Electronic Circuits and Control Devices'],
        priorityNote: 'Smaller PE bucket, but common trap area. Review converters, inverter-based resources, VFDs, relays, switches, Boolean logic, and ladder logic.',
        focus: 'Converters, inverter-based resources, VFDs, relays, switches, Boolean logic, and ladder logic.',
        sample: {
          prompt: 'In a VFD application, the drive primarily controls motor speed by varying:',
          options: ['Output frequency', 'Conductor ampacity', 'Transformer turns ratio', 'Fuse interrupting rating'],
          answer: 'Output frequency',
          explanation: 'For ac machines, synchronous speed is proportional to frequency. A VFD controls motor speed by changing the supplied frequency.',
          formulaHint: 'AC motor speed cue: ns = 120f/p.',
          steps: ['Recognize VFD means variable-frequency drive.', 'Recall ac motor speed depends on applied frequency and pole count.', 'A VFD changes the output frequency.', 'Select output frequency.'],
          optionFeedback: {
            'Output frequency': 'Correct. Frequency is the primary speed-control variable.',
            'Conductor ampacity': 'Ampacity affects conductor sizing, not speed command.',
            'Transformer turns ratio': 'Turns ratio changes voltage/current relationship, not VFD speed control.',
            'Fuse interrupting rating': 'Interrupting rating is a protection capacity, not a control variable.',
          },
          trap: 'For VFD questions, connect speed control to frequency before thinking about current or protection.',
          handbookHint: 'PE Power spec: Power electronics, variable frequency drives; FE handbook machine speed relation ns=120f/p.',
        },
      },
    ],
  },
];

export default function ExamsPage() {
  const [examId, setExamId] = useState<ExamId>('fe-electrical');
  const [selected, setSelected] = useState(0);
  const [formulaIdx, setFormulaIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState<Record<string, SectionConfidence>>({});
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);
  const exam = EXAMS.find(e => e.id === examId) ?? EXAMS[0];
  const section = exam.sections[selected] ?? exam.sections[0];
  const formulaSection = FE_FORMULA_SECTIONS[formulaIdx] ?? FE_FORMULA_SECTIONS[0];
  const selectedAnswer = answers[`${exam.id}:${section.name}`];
  const answeredCurrent = !!selectedAnswer;
  const isCorrectCurrent = answersMatch(selectedAnswer, section.sample.answer, section.sample.options);
  const displayAnswer = resolveCorrectAnswer(section.sample.answer, section.sample.options);
  const answered = exam.sections.filter(s => answers[`${exam.id}:${s.name}`]).length;
  const progress = Math.round((answered / exam.sections.length) * 100);
  const prioritySections = [...exam.sections]
    .filter(s => s.questionRange)
    .sort((a, b) => rangeTotal(b.questionRange) - rangeTotal(a.questionRange));
  const maxPriority = Math.max(...prioritySections.map(s => rangeMidpoint(s.questionRange)), 1);
  const examWeight = Math.max(prioritySections.reduce((sum, s) => sum + rangeMidpoint(s.questionRange), 0), 1);
  const readiness = Math.round(prioritySections.reduce((sum, s) => {
    const key = `${exam.id}:${s.name}`;
    const answeredValue = answersMatch(answers[key], s.sample.answer, s.sample.options) ? 1 : answers[key] ? 0.25 : 0;
    const confidenceValue = confidenceScore(confidence[key]);
    return sum + rangeMidpoint(s.questionRange) * Math.max(answeredValue, confidenceValue);
  }, 0) / examWeight * 100);
  const nextTarget = prioritySections.find(s => {
    const key = `${exam.id}:${s.name}`;
    return !answersMatch(answers[key], s.sample.answer, s.sample.options) || confidence[key] !== 'ready';
  }) ?? prioritySections[0];
  const missedSections = exam.sections.filter(s => {
    const key = `${exam.id}:${s.name}`;
    return answers[key] && !answersMatch(answers[key], s.sample.answer, s.sample.options);
  });

  function chooseExam(next: ExamId) {
    setExamId(next);
    setSelected(0);
  }

  function answer(value: string) {
    setAnswers(a => ({ ...a, [`${exam.id}:${section.name}`]: value }));
  }

  function markConfidence(value: SectionConfidence) {
    setConfidence(c => ({ ...c, [`${exam.id}:${section.name}`]: value }));
  }

  function askAiForPlan() {
    setChatContext({
      type: 'exam',
      topic: exam.title,
      front: 'Build me a pass-focused study plan from my current FE/PE prep status.',
      back: nextTarget?.name ?? 'Exam prep',
      topicDescription: [
        `Weighted readiness estimate: ${readiness}%.`,
        `Next target section: ${nextTarget?.name ?? 'none'}.`,
        `Missed sections: ${missedSections.map(s => s.name).join(', ') || 'none yet'}.`,
        `Current section: ${section.name}.`,
        section.priorityNote ? `Current priority note: ${section.priorityNote}` : '',
      ].filter(Boolean).join('\n'),
    });
  }

  function askAiAboutQuestion() {
    setChatContext({
      type: 'exam',
      topic: `${exam.title}: ${section.name}`,
      front: section.sample.prompt,
      back: section.sample.answer,
      userAnswer: selectedAnswer,
      topicDescription: [
        section.sample.explanation,
        `Formula/concept: ${section.sample.formulaHint}`,
        `Steps: ${section.sample.steps.join(' ')}`,
        selectedAnswer ? `Selected-answer feedback: ${section.sample.optionFeedback[selectedAnswer] ?? ''}` : '',
        `Common trap: ${section.sample.trap}`,
      ].filter(Boolean).join('\n'),
    });
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      <PageHeader
        title="FE / PE Exam Prep"
        subtitle="Section-by-section readiness tool with local sample questions"
        action={<ButtonLink href={exam.sourceUrl} target="_blank" rel="noreferrer">{exam.sourceLabel}</ButtonLink>}
      />

      <Panel variant="sheen" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {EXAMS.map(e => (
                <Button
                  key={e.id}
                  onClick={() => chooseExam(e.id)}
                  variant={e.id === exam.id ? 'primary' : 'quiet'}
                  size="sm"
                >
                  {e.id === 'fe-electrical' ? 'FE Electrical' : 'PE Power'}
                </Button>
              ))}
            </div>
            <div style={{ color: 'var(--tx)', fontSize: 18, fontWeight: 850, marginBottom: 4 }}>{exam.title}</div>
            <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.5 }}>{exam.subtitle}</div>
          </div>
          <div style={{ minWidth: 120, textAlign: 'right' }}>
            <div style={{ color: 'var(--sky)', fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{progress}%</div>
            <div style={{ color: 'var(--tx-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Sample coverage</div>
          </div>
        </div>
        <div style={{ height: 8, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--sky)', borderRadius: 99 }} />
        </div>
      </Panel>

      <section className="card-sheen" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.75fr) minmax(0, 1.25fr)', gap: 14, alignItems: 'stretch' }}>
          <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--bd)', borderRadius: 11, padding: 14 }}>
            <div style={{ color: 'var(--tx-3)', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Pass readiness
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: 8, marginBottom: 10 }}>
              <span style={{ color: readiness >= 70 ? 'var(--green)' : readiness >= 45 ? 'var(--sky)' : 'var(--amber)', fontSize: 40, fontWeight: 950, lineHeight: 1 }}>{readiness}%</span>
              <span style={{ color: 'var(--tx-3)', fontSize: 11, fontWeight: 850, marginBottom: 5 }}>weighted by exam count</span>
            </div>
            <div style={{ height: 8, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${readiness}%`, background: readiness >= 70 ? 'var(--green)' : 'linear-gradient(90deg, var(--a), var(--a-2))', borderRadius: 99 }} />
            </div>
            <div style={{ color: 'var(--tx-2)', fontSize: 12, lineHeight: 1.45 }}>
              This is a local progress signal based on sample correctness, confidence marks, and official section weight. Use it to steer practice, not as a guarantee.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--bd)', borderRadius: 11, padding: 13 }}>
              <div style={{ color: 'var(--a-light)', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Next target</div>
              <div style={{ color: 'var(--tx)', fontSize: 14, fontWeight: 850, lineHeight: 1.3, marginBottom: 6 }}>{nextTarget?.name ?? section.name}</div>
              <div style={{ color: 'var(--tx-3)', fontSize: 11.5, lineHeight: 1.4 }}>{nextTarget?.priorityNote ?? 'Work the current section until you can explain the method without looking.'}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--bd)', borderRadius: 11, padding: 13 }}>
              <div style={{ color: 'var(--red)', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Mistake queue</div>
              <div style={{ color: 'var(--tx)', fontSize: 24, fontWeight: 900, lineHeight: 1, marginBottom: 7 }}>{missedSections.length}</div>
              <div style={{ color: 'var(--tx-3)', fontSize: 11.5, lineHeight: 1.4 }}>{missedSections.length ? missedSections.map(s => s.name).join(', ') : 'No misses logged in this session yet.'}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--bd)', borderRadius: 11, padding: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ color: 'var(--sky)', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Study coach</div>
              <div style={{ color: 'var(--tx-3)', fontSize: 11.5, lineHeight: 1.4, flex: 1 }}>Generate a targeted plan from your misses, weak marks, and highest-yield sections.</div>
              <Button size="sm" onClick={askAiForPlan}>Ask AI for plan</Button>
            </div>
          </div>
        </div>
      </section>

      {prioritySections.length > 0 && (
        <section className="card-sheen" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 13 }}>
            <div>
              <div style={{ color: 'var(--a-light)', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                Priority map from {exam.id === 'fe-electrical' ? 'FE Handbook 10.6' : 'NCEES PE Power specs'}
              </div>
              <div style={{ color: 'var(--tx)', fontSize: 17, fontWeight: 850 }}>Study the highest question-count sections first</div>
              <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.5, marginTop: 4 }}>
                The app combines related exam buckets where it makes practice more efficient. Use this order when time is limited.
              </div>
            </div>
            <div style={{ minWidth: 116, textAlign: 'right' }}>
              <div style={{ color: 'var(--a-light)', fontSize: 24, fontWeight: 950, lineHeight: 1 }}>{prioritySections[0]?.questionRange?.[1] ?? 0}</div>
              <div style={{ color: 'var(--tx-3)', fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Max questions</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {prioritySections.map((item, rank) => {
              const active = item.name === section.name;
              const tone = priorityTone(item.questionRange);
              const pct = Math.round((rangeMidpoint(item.questionRange) / maxPriority) * 100);
              const idx = exam.sections.findIndex(s => s.name === item.name);
              return (
                <button
                  key={item.name}
                  onClick={() => setSelected(idx)}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '34px minmax(0, 1fr) 112px',
                    gap: 11,
                    alignItems: 'center',
                    textAlign: 'left',
                    padding: '10px 11px',
                    borderRadius: 10,
                    background: active ? 'var(--a-dim)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${active ? 'rgba(34,211,238,0.34)' : 'var(--bd)'}`,
                    color: 'var(--tx)',
                  }}
                >
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: tone.bg,
                    border: `1px solid ${tone.border}`,
                    color: tone.color,
                    fontSize: 12,
                    fontWeight: 900,
                  }}>
                    {rank + 1}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 850 }}>{item.name}</span>
                      <span style={{ color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 999, padding: '1px 7px', fontSize: 9.5, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {tone.label}
                      </span>
                    </span>
                    <span style={{ display: 'block', color: 'var(--tx-3)', fontSize: 11, lineHeight: 1.35 }}>
                      {rangeLabel(item.questionRange)} · {item.handbookBuckets?.join(' + ')}
                    </span>
                  </span>
                  <span style={{ display: 'grid', gap: 5 }}>
                    <span style={{ color: 'var(--tx-2)', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>{rangeLabel(item.questionRange).replace(' questions', ' q')}</span>
                    <span style={{ height: 6, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--a), var(--a-2))', borderRadius: 99 }} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {exam.id === 'fe-electrical' && (
        <section className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
            <div>
              <div style={{ color: 'var(--sky)', fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                Offline formula reference
              </div>
              <div style={{ color: 'var(--tx)', fontSize: 18, fontWeight: 850, lineHeight: 1.2 }}>FE formula reference</div>
              <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.5, marginTop: 5 }}>
                This page uses your downloaded FE Reference Handbook 10.6 from the local project folder, plus a compact offline formula drill for faster review.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span className="badge badge-green" style={{ alignSelf: 'center' }}>Offline ready</span>
                  <ButtonLink href={LOCAL_FE_HANDBOOK_URL} target="_blank" rel="noreferrer" variant="primary">
                    Open local manual
                  </ButtonLink>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FE_FORMULA_SECTIONS.map((item, i) => {
                const active = i === formulaIdx;
                return (
                  <button
                    key={item.name}
                    onClick={() => setFormulaIdx(i)}
                    style={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      padding: '9px 10px',
                      borderRadius: 8,
                      background: active ? 'var(--sky-d)' : 'var(--s2)',
                      border: `1px solid ${active ? 'rgba(56,189,248,0.28)' : 'var(--bd)'}`,
                      color: active ? 'var(--tx)' : 'var(--tx-2)',
                      fontWeight: active ? 750 : 500,
                    }}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: 14 }}>
              <div style={{ color: 'var(--tx)', fontSize: 15, fontWeight: 850, marginBottom: 5 }}>{formulaSection.name}</div>
              <div style={{ color: 'var(--tx-3)', fontSize: 12, lineHeight: 1.45, marginBottom: 12 }}>
                {formulaSection.handbookTarget}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBottom: 12 }}>
                {formulaSection.formulas.map(formula => (
                  <div
                    key={formula}
                    style={{
                      background: 'var(--s1)',
                      border: '1px solid var(--bd)',
                      borderRadius: 8,
                      padding: '10px 11px',
                      color: 'var(--tx)',
                      fontFamily: '"Cambria Math", "STIX Two Math", "Times New Roman", ui-serif, serif',
                      fontSize: 15,
                      lineHeight: 1.35,
                    }}
                  >
                    <MathText text={formula} />
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--sky-d)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '10px 11px', color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.45 }}>
                <span style={{ color: 'var(--sky)', fontWeight: 850 }}>Lookup drill: </span>
                {formulaSection.drill}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--bd)' }}>
              <div>
                <div style={{ color: 'var(--tx)', fontSize: 13, fontWeight: 850 }}>FE Handbook 10.6</div>
                <div style={{ color: 'var(--tx-3)', fontSize: 11, lineHeight: 1.35 }}>Served locally from public/fe-handbook-10-6.pdf</div>
              </div>
              <ButtonLink href={LOCAL_FE_HANDBOOK_URL} target="_blank" rel="noreferrer" size="sm">
                Full tab
              </ButtonLink>
            </div>
            <object
              data={`${LOCAL_FE_HANDBOOK_URL}#view=FitH`}
              type="application/pdf"
              style={{ width: '100%', height: 460, display: 'block', background: 'var(--s1)' }}
            >
              <div style={{ padding: 16, color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.5 }}>
                Your browser did not render the PDF inline. Open the local manual in a new tab with the button above.
              </div>
            </object>
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <section className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, padding: '4px 6px 10px' }}>
            Exam Sections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {exam.sections.map((s, i) => {
              const active = i === selected;
              const done = !!answers[`${exam.id}:${s.name}`];
              const tone = priorityTone(s.questionRange);
              return (
                <button
                  key={s.name}
                  onClick={() => setSelected(i)}
                  style={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    alignItems: 'flex-start',
                    background: active ? 'var(--a-dim)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(34,211,238,0.28)' : 'var(--bd)'}`,
                    borderRadius: 9,
                    padding: '10px 11px',
                    color: 'var(--tx)',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 750 }}>{s.name}</span>
                      {s.questionRange && (
                        <span style={{ color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 999, padding: '0 6px', fontSize: 9, fontWeight: 900 }}>
                          {s.questionRange[0]}-{s.questionRange[1]}
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'block', color: 'var(--tx-3)', fontSize: 11, marginTop: 2 }}>
                      {s.questionRange ? tone.label : s.weight} · {s.focus}
                    </span>
                  </span>
                  {done && <span style={{ color: 'var(--green)', fontWeight: 900, flexShrink: 0 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ color: 'var(--sky)', fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                {section.questionRange ? `${priorityTone(section.questionRange).label} · ${rangeLabel(section.questionRange)}` : `${section.weight} section`}
              </div>
              <div style={{ color: 'var(--tx)', fontSize: 20, fontWeight: 850 }}>{section.name}</div>
              <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.55, marginTop: 5 }}>{section.focus}</div>
              {section.priorityNote && (
                <div style={{ marginTop: 8, color: 'var(--a-light)', background: 'var(--a-dim)', border: '1px solid rgba(34,211,238,0.22)', borderRadius: 8, padding: '8px 10px', fontSize: 12, lineHeight: 1.45 }}>
                  {section.priorityNote}
                </div>
              )}
            </div>
            <div style={{ minWidth: 196, display: 'grid', gap: 7 }}>
              <div style={{ color: 'var(--tx-3)', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>
                Self mark
              </div>
              <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {(['weak', 'review', 'ready'] as SectionConfidence[]).map(value => {
                  const active = confidence[`${exam.id}:${section.name}`] === value;
                  const color = value === 'ready' ? 'var(--green)' : value === 'review' ? 'var(--sky)' : 'var(--amber)';
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => markConfidence(value)}
                      style={{
                        padding: '6px 9px',
                        borderRadius: 8,
                        background: active ? 'var(--a-dim)' : 'rgba(255,255,255,0.035)',
                        border: `1px solid ${active ? 'rgba(34,211,238,0.32)' : 'var(--bd)'}`,
                        color: active ? color : 'var(--tx-2)',
                        fontSize: 11.5,
                        fontWeight: 850,
                      }}
                    >
                      {confidenceLabel(value)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="practice-question-card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div className="practice-card-label">Sample question</div>
                <div style={{ color: 'var(--tx-3)', fontSize: 11, marginTop: 3 }}>Choose an answer to unlock the worked review.</div>
              </div>
              {answeredCurrent && (
                <span className={isCorrectCurrent ? 'badge badge-green' : 'badge badge-red'}>
                  {isCorrectCurrent ? 'Correct' : 'Review'}
                </span>
              )}
            </div>
            <div className="practice-question-text" style={{ marginBottom: 14 }}>
              <MathText text={section.sample.prompt} />
            </div>
            <div className="practice-options">
              {section.sample.options.map((option, optionIdx) => {
                const picked = selectedAnswer === option;
                const revealed = !!selectedAnswer;
                const correct = answersMatch(option, section.sample.answer, section.sample.options);
                return (
                  <AnswerChoice
                    key={option}
                    label={String.fromCharCode(65 + optionIdx)}
                    text={option}
                    selected={picked}
                    correct={revealed && correct}
                    wrong={revealed && picked && !correct}
                    muted={revealed && !picked && !correct}
                    status={revealed && correct ? 'Correct' : revealed && picked && !correct ? 'Your pick' : ''}
                    onClick={() => answer(option)}
                  />
                );
              })}
            </div>
          </div>

          {answeredCurrent && (
            <div style={{ display: 'grid', gap: 12 }}>
              <ReviewPanel
                correct={isCorrectCurrent}
                title={isCorrectCurrent ? 'Correct' : 'Review this one'}
                action={
                  <button type="button" onClick={askAiAboutQuestion} className="practice-ai-button">
                    Ask AI
                  </button>
                }
                userAnswer={<MathText text={selectedAnswer ?? ''} />}
                correctAnswer={<MathText text={displayAnswer} />}
                explanation={<MathText text={section.sample.explanation} />}
              />

              {!isCorrectCurrent && selectedAnswer && (
                <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: '13px 14px' }}>
                  <div style={{ color: 'var(--red)', fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Why your answer missed
                  </div>
                  <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.55 }}>
                    <MathText text={section.sample.optionFeedback[selectedAnswer] ?? 'That choice does not match the controlling concept for this problem.'} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.15fr)', gap: 12 }}>
                <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: '13px 14px' }}>
                  <div style={{ color: 'var(--sky)', fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                    Formula / concept cue
                  </div>
                  <div style={{ color: 'var(--tx)', fontSize: 13.5, lineHeight: 1.55, marginBottom: 10 }}>
                    <MathText text={section.sample.formulaHint} />
                  </div>
                  <div style={{ color: 'var(--tx-3)', fontSize: 11.5, lineHeight: 1.45 }}>
                    {section.sample.handbookHint}
                  </div>
                </div>

                <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: '13px 14px' }}>
                  <div style={{ color: 'var(--tx-3)', fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Fastest solution path
                  </div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {section.sample.steps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.45 }}>
                        <span style={{ width: 21, height: 21, borderRadius: 7, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--s3)', color: 'var(--sky)', fontSize: 10.5, fontWeight: 850 }}>{i + 1}</span>
                        <span><MathText text={step} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--amber-d)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '11px 13px', color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--amber)', fontWeight: 850 }}>Common trap: </span>
                <MathText text={section.sample.trap} />
              </div>
            </div>
          )}
        </section>
      </div>
      {chatContext && (
        <AiChat
          context={chatContext}
          onClose={() => setChatContext(null)}
          greeting={`I can help review this ${section.name} problem. Ask me to walk through the fastest method, explain the trap, or generate a similar exam-style question.`}
        />
      )}
    </div>
  );
}
