/** A paragraph, or a list of points. */
export type Block = string | { list: string[] };

export interface LegalSection {
  id: string;
  title: string;
  blocks: Block[];
}

export interface LegalDocument {
  title: string;
  /** ISO date the text was last changed. */
  updated: string;
  intro?: string;
  sections: LegalSection[];
}

export interface HelpQuestion {
  id: string;
  question: string;
  answer: Block[];
}

/** The words of the help and legal pages for one country: laws, regulators and time limits differ between countries. */
export interface CountryContent {
  terms: LegalDocument;
  privacy: LegalDocument;
  help: HelpQuestion[];
}
