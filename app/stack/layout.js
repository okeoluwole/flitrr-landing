const TITLE = 'STACK. Feasibility and Funding';
const DESCRIPTION =
  'STACK is the Flitrr product for feasibility and funding. Test whether a scheme stacks up and how to fund it, with a deterministic development appraisal and funding model.';
const URL = 'https://flitrr.com/stack';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    url: URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Flitrr',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function StackLayout({ children }) {
  return children;
}
