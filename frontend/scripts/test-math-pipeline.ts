import { normalizeQuestionMathText } from "../src/lib/questionMathText";

const cases = [
  String.raw`Let z=8.800cis(1.540). Find Re(z^{2}) to 3 d.p.`,
  String.raw`Let z=8.800\operatorname{cis}(1.540). Find \operatorname{Re}(z^{2}) to 3 d.p.`,
  String.raw`$1+i=\sqrt2\,\operatorname{cis}(\frac\pi4)$`,
  String.raw`For $f(x)=\frac{\log_{e} x}{x}$, $f'(x)$ is`,
  String.raw`$\frac{1-\log_e x}{x^2}$`,
  String.raw`$\frac{1-\\\log_{e} x}{x^{2}}$`,
  String.raw`A sample proportion is $\hat p=0.36$ from a sample of size $n=400$. Find the standard deviation of $\hat P$, assuming the population proportion is $0.36$.`,
  String.raw`For a sample proportion $\hat P$ with population proportion $p=0.2$, which sample size gives $\operatorname{sd}(\hat P)=0.04$?`,
  String.raw`Find \frac{d}{dx}\left\frac{x^{2}+1}{e^x}\right$$.`,
];

for (const c of cases) {
  console.log("IN :", c);
  console.log("OUT:", normalizeQuestionMathText(c));
  console.log("---");
}
