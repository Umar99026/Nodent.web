import{It as e,Lt as t,Qt as n,Ut as r,Wt as i,Xt as a,Zt as o,in as s,tn as c,zt as l}from"./utils-CL_p5zb-.js";import{t as u}from"./AppShell-DECOW87e.js";import{t as d}from"./RichQuestionContent-CCoYgPcd.js";import{c as f,m as p}from"./input-D0G-aqYc.js";import{t as m}from"./separator-UU5Q3zbA.js";import{t as h}from"./book-open-B1c6v6nd.js";import{a as g,i as _,n as v,r as y,t as b}from"./select-7fUAgfZc.js";import{t as x}from"./loader-circle-D97eN05R.js";import{a as S,n as C,o as w,t as T}from"./card-CHBnpVfN.js";import{n as E,t as D}from"./practiceQuestions-C6Myfubt.js";import{t as O}from"./badge-LaA5dnrX.js";import{t as k}from"./subjects-C2FejBaK.js";var A=p(`arrow-right`,[[`path`,{d:`M5 12h14`,key:`1ays0h`}],[`path`,{d:`m12 5 7 7-7 7`,key:`xquz4c`}]]),j=p(`sparkles`,[[`path`,{d:`M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z`,key:`1s2grr`}],[`path`,{d:`M20 2v4`,key:`1rf3ol`}],[`path`,{d:`M22 4h-4`,key:`gwowj6`}],[`circle`,{cx:`4`,cy:`20`,r:`2`,key:`6kqj1y`}]]),M=s(c(),1);function N(e){return String(e??``).trim().toLowerCase()}function P(e){return/math|methods|specialist|further/i.test(e)}function F(e){let t=N(e);return/prob|random|binom|normal|z[-\s]?score|hypothesis|sampling|confidence/i.test(t)?`### ${e}

**Core formulas**
- \(z = \\frac{x-\\mu}{\\sigma}\\)
- \(P(a<X<b)=P\\left(\\frac{a-\\mu}{\\sigma}<Z<\\frac{b-\\mu}{\\sigma}\\right)\)
- Binomial: \(P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}\)
- \(E(X)=np\), \(\\mathrm{Var}(X)=np(1-p)\)

**Checklist**
- Identify the distribution + parameters (\(n,p\) or \(\\mu,\\sigma\))
- Convert to a standard form (often \(Z\))
- Be explicit with “at least / at most / between”

**Common traps**
- Rounding too early, or using \(\\sigma\\) vs \(\\sigma^2\)
- Forgetting continuity correction when appropriate`:/finance|interest|annuity|loan|amort|present value|future value/i.test(t)?`### ${e}

**Core formulas**
- Compound interest: \(A=P(1+i)^n\)
- Present value: \(P=\\frac{A}{(1+i)^n}\)
- Annuity (FV): \(A=R\\frac{(1+i)^n-1}{i}\)
- Annuity (PV): \(P=R\\frac{1-(1+i)^{-n}}{i}\)

**Checklist**
- Decide if it’s a single lump sum or a stream of payments
- Keep units consistent (monthly rate with months)
- State your rate \(i\) clearly (as a decimal)

**Common traps**
- Mixing annual rate with monthly \(n\)
- Using PV formula when the question wants FV (or vice‑versa)`:/calculus|different|derivative|integral|area|rate of change|antiderivative/i.test(t)?`### ${e}

**Core formulas**
- Power rule: \\(\\frac{d}{dx}x^n = nx^{n-1}\\)
- Product rule: \\((uv)'=u'v+uv'\\)
- Chain rule: \\(\\frac{d}{dx}f(g(x)) = f'(g(x))g'(x)\\)
- Fundamental theorem: \\(\\int_a^b f(x)\\,dx = F(b)-F(a)\\)

**Checklist**
- Write the function cleanly before differentiating/integrating
- Mark turning points by solving \(f'(x)=0\)
- For area, check sign (area vs signed area)

**Common traps**
- Forgetting chain rule factors
- Dropping absolute values for “distance/area”`:`### ${e}

**Quick refresher**
- Write down the key definitions for this topic.
- List the 2–3 formulas you keep using.
- Watch for unit consistency and rounding rules.

Hit **Questions** when you’re ready.`}function I(e){return e===`A`?`### Section A — Text response

**What markers want**
- A clear contention / controlling idea
- Evidence (quotes) + analysis (how it proves your point)
- Tight paragraph structure (topic sentence → evidence → analysis → link)

**Micro‑checklist**
- Define key theme/author intention in the first paragraph
- Embed quotes (don’t “quote dump”)
- Explain *so what?* after each quote`:e===`B`?`### Section B — Creative writing

**What markers want**
- Strong idea + consistent voice
- Purposeful crafting choices (imagery, motif, structure)
- A clear relationship to the stimulus (not just a copy)

**Micro‑checklist**
- Establish setting/character quickly
- Use sensory detail with restraint
- End with a deliberate shift or resolution`:`### Section C — Writing / argument analysis

**What markers want**
- Accurate identification of argument + audience
- Clear explanation of techniques and intended effect
- Control (don’t list devices—analyse impact)

**Micro‑checklist**
- Start with argument map (contention + key points)
- Analyse techniques in context (quote → technique → effect)
- Track tone shifts and audience targeting`}function L(e){let t=e.subject?.name??e.subjectId;if(e.subjectId===`english`)return I(e.englishSection??`A`);let n=(e.topic??`all`).trim();return!n||n===`all`?`### Your plan
- Pick a topic to focus your practice.
- Skim the overview (formulas / theory).
- Hit **Questions** to start.

**Subject:** ${t}`:P(t)?F(n):`### ${n}

**Quick overview for ${t}**
- Key definitions you should be able to say in one sentence
- 3 high‑yield facts / rules for this topic
- What a “full marks” answer usually includes

**Common traps**
- Vague explanations (be specific, use examples)
- Not linking evidence back to the question wording`}var R=t();function z(e){return Array.from(new Set(e.map(e=>e.trim()).filter(Boolean))).sort((e,t)=>e.localeCompare(t))}function B(){let{subjectId:t}=o(),s=a(),{user:c}=e(),[p]=n(),N=(0,M.useMemo)(()=>k.find(e=>String(e.id)===String(t)),[t]),[P,F]=(0,M.useState)(!0),[I,B]=(0,M.useState)([]),V=String(t)===`english`,H=String(p.get(`topic`)??`all`),U=String(p.get(`section`)??`A`).toUpperCase()||`A`,[W,G]=(0,M.useState)(H||`all`),[K,q]=(0,M.useState)(U===`B`||U===`C`?U:`A`);(0,M.useEffect)(()=>{if(!t)return;let e=!1;return(async()=>{try{if(F(!0),!c){B(N?.quiz??[]);return}let n=await l(r.bootstrap);if(e)return;n.customQuestions&&localStorage.setItem(i.customQuestions,JSON.stringify(n.customQuestions));let a=E(D(n.customQuestions,t));B(a.length?a:N?.quiz??[])}catch{B(N?.quiz??[])}finally{e||F(!1)}})(),()=>{e=!0}},[t,N?.quiz,c]);let J=(0,M.useMemo)(()=>V?[]:[`all`,...z(I.map(e=>e.topic??`General`))],[I,V]);(0,M.useEffect)(()=>{V||J.length&&!J.includes(W)&&G(`all`)},[J,W,V]);let Y=(0,M.useMemo)(()=>L({subjectId:String(t??``),subject:N,topic:W,englishSection:K}),[K,N,t,W]);return(0,R.jsx)(u,{title:N?`${N.name} Practice`:`Practice`,subtitle:`Choose your focus, skim the overview, then start questions.`,edgeToEdgeHeader:!0,edgeToEdgeMain:!0,children:(0,R.jsxs)(`div`,{className:`mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[420px_1fr]`,children:[(0,R.jsxs)(T,{className:`overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm`,children:[(0,R.jsx)(`div`,{className:`h-1.5 bg-gradient-to-r from-brand via-brand-light to-amber`}),(0,R.jsxs)(S,{className:`space-y-2`,children:[(0,R.jsxs)(`div`,{className:`flex items-center justify-between gap-2`,children:[(0,R.jsx)(w,{className:`font-display text-xl text-[#0b0f19]`,children:`Practice setup`}),(0,R.jsxs)(O,{variant:`secondary`,className:`gap-1`,children:[(0,R.jsx)(j,{className:`size-3.5`}),`Focus mode`]})]}),(0,R.jsx)(`p`,{className:`text-sm text-muted-foreground`,children:`Choose what you want to study, then jump into questions.`})]}),(0,R.jsxs)(C,{className:`space-y-5`,children:[P?(0,R.jsxs)(`div`,{className:`flex items-center gap-2 rounded-xl border border-black/10 bg-slate-50 p-4 text-sm text-muted-foreground`,children:[(0,R.jsx)(x,{className:`size-4 animate-spin`}),`Loading topics…`]}):V?(0,R.jsxs)(`div`,{className:`space-y-2`,children:[(0,R.jsx)(`p`,{className:`text-xs font-semibold uppercase tracking-wide text-muted-foreground`,children:`English section`}),(0,R.jsxs)(b,{value:K,onValueChange:e=>q(e??`A`),children:[(0,R.jsx)(_,{className:`h-11 border-black/10 bg-white text-[#0b0f19]`,children:(0,R.jsx)(g,{placeholder:`Choose section`})}),(0,R.jsxs)(v,{children:[(0,R.jsx)(y,{value:`A`,children:`Section A — Text response`}),(0,R.jsx)(y,{value:`B`,children:`Section B — Creative`}),(0,R.jsx)(y,{value:`C`,children:`Section C — Writing`})]})]})]}):(0,R.jsxs)(`div`,{className:`space-y-2`,children:[(0,R.jsx)(`p`,{className:`text-xs font-semibold uppercase tracking-wide text-muted-foreground`,children:`Topic`}),(0,R.jsxs)(b,{value:W,onValueChange:e=>G(e??`all`),children:[(0,R.jsx)(_,{className:`h-11 border-black/10 bg-white text-[#0b0f19]`,children:(0,R.jsx)(g,{placeholder:`Choose topic`})}),(0,R.jsx)(v,{children:J.map(e=>(0,R.jsx)(y,{value:e,children:e===`all`?`All topics`:e},e))})]})]}),(0,R.jsx)(m,{}),(0,R.jsxs)(`div`,{className:`flex flex-col gap-2`,children:[(0,R.jsxs)(f,{onClick:()=>{if(t){if(V){s(`/quiz/english?section=${encodeURIComponent(K)}`);return}s(`/quiz/${t}${W&&W!==`all`?`?topic=${encodeURIComponent(W)}`:``}`)}},className:`h-11 gap-2 bg-brand text-white hover:bg-brand-dark`,children:[(0,R.jsx)(h,{className:`size-4`}),`Questions`,(0,R.jsx)(A,{className:`size-4`})]}),(0,R.jsx)(f,{variant:`outline`,className:`h-11`,onClick:()=>s(`/dashboard`),children:`Back to dashboard`})]})]})]}),(0,R.jsxs)(T,{className:`rounded-2xl border border-black/10 bg-white/80 shadow-sm backdrop-blur`,children:[(0,R.jsxs)(S,{className:`space-y-2`,children:[(0,R.jsx)(w,{className:`font-display text-xl text-[#0b0f19]`,children:`Overview`}),(0,R.jsx)(`p`,{className:`text-sm text-muted-foreground`,children:`A quick refresher before you start.`})]}),(0,R.jsx)(C,{children:(0,R.jsx)(`div`,{className:`prose prose-slate max-w-none`,children:(0,R.jsx)(d,{text:Y,className:`prose max-w-none`})})})]})]})})}export{B as default};