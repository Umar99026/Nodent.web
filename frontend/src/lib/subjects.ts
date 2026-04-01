export type QuestionType = "mcq" | "short" | "long";

export interface BaseQuestion {
  type: QuestionType;
  topic: string;
  question: string;
  imageUrls?: string[];
  marks?: number;
  guidance?: string;
  passage?: string;
  /** Set for admin / DB-backed questions (stable practice keys). */
  id?: number;
}

export interface McqQuestion extends BaseQuestion {
  type: "mcq";
  options: string[];
  answer: string;
}

export interface ShortQuestion extends BaseQuestion {
  type: "short";
  acceptedAnswers: string[];
}

export interface LongQuestion extends BaseQuestion {
  type: "long";
  /**
   * Optional accepted answers/keywords for scoring long responses.
   * Populated for custom questions from admin.
   */
  acceptedAnswers?: string[];
  /**
   * Optional single answer text for scoring long responses.
   * (Used only if `acceptedAnswers` is not provided.)
   */
  answer?: string;
}

export type Question = McqQuestion | ShortQuestion | LongQuestion;

export interface Subject {
  id: string;
  name: string;
  category: string;
  description: string;
  quiz: Question[];
}

export const baseSubjects: Subject[] = [
  {
    id: "english",
    name: "English",
    category: "English",
    description:
      "Text response, argument analysis, comparative writing, and language development.",
    quiz: [
      {
        type: "long",
        topic: "Argument Analysis",
        question:
          "Read the passage below and explain how language choices shape the reader's response. Refer closely to tone, persuasive devices, and intended audience.",
        passage:
          "\u2018We cannot keep calling these changes temporary when they are already shaping the future of entire communities. Every season of delay comes with another cost, another loss, another opportunity abandoned. The question is no longer whether action is necessary, but whether we are prepared to act with courage rather than convenience.\u2019",
        guidance:
          "Write a sustained analytical response. Aim for a clear contention, close analysis of language, and logical paragraphing.",
      },
      {
        type: "long",
        topic: "Essay Writing",
        question:
          "Discuss how a strong introduction establishes the direction of an English essay.",
        guidance:
          "Write an essay-style response with a clear central argument and developed explanation.",
      },
      {
        type: "short",
        topic: "Essay Writing",
        question: "What is the main purpose of a thesis statement?",
        acceptedAnswers: [
          "to provide a clear central argument",
          "to state the main argument",
          "to present the main argument",
          "to establish the essay's argument",
        ],
      },
      {
        type: "mcq",
        topic: "Argument Analysis",
        question: "Argument analysis mainly focuses on:",
        options: [
          "Counting paragraphs only",
          "How persuasive techniques shape the reader",
          "Memorising every sentence",
          "Ignoring tone and contention",
        ],
        answer: "How persuasive techniques shape the reader",
      },
      {
        type: "mcq",
        topic: "Language Devices",
        question: "A metaphor is best described as:",
        options: [
          "A direct comparison",
          "A punctuation mark",
          "A summary paragraph",
          "A topic sentence",
        ],
        answer: "A direct comparison",
      },
    ],
  },
  {
    id: "methods",
    name: "Mathematical Methods",
    category: "Mathematics",
    description:
      "Functions, calculus, probability, algebra, graphs, and mathematical modelling.",
    quiz: [
      {
        type: "mcq",
        topic: "Calculus",
        question: "What is the derivative of x\u00B2?",
        options: ["x", "2x", "x\u00B2", "2"],
        answer: "2x",
      },
      {
        type: "short",
        topic: "Functions & Graphs",
        question: "State the gradient of a horizontal line.",
        acceptedAnswers: ["0", "zero"],
      },
      {
        type: "mcq",
        topic: "Trigonometry",
        question: "What is sin(90\u00B0)?",
        options: ["0", "1", "-1", "0.5"],
        answer: "1",
      },
      {
        type: "mcq",
        topic: "Algebra",
        question: "3 + 5 \u00D7 2 equals:",
        options: ["16", "13", "10", "8"],
        answer: "13",
      },
    ],
  },
  {
    id: "general-maths",
    name: "General Mathematics",
    category: "Mathematics",
    description:
      "Statistics, finance, networks, matrices, measurement, and applied problem solving.",
    quiz: [
      {
        type: "mcq",
        topic: "Statistics",
        question: "25% of 200 is:",
        options: ["25", "50", "75", "100"],
        answer: "50",
      },
      {
        type: "short",
        topic: "Statistics",
        question: "What is the mean of 4, 6 and 8?",
        acceptedAnswers: ["6", "6.0"],
      },
      {
        type: "mcq",
        topic: "Measurement",
        question: "Angles in a triangle add to:",
        options: ["90\u00B0", "180\u00B0", "270\u00B0", "360\u00B0"],
        answer: "180\u00B0",
      },
    ],
  },
  {
    id: "biology",
    name: "Biology",
    category: "Science",
    description:
      "Cells, genetics, evolution, immunity, and biological systems.",
    quiz: [
      {
        type: "mcq",
        topic: "Cell Biology",
        question: "The basic unit of life is the:",
        options: ["Cell", "Organ", "Tissue", "Atom"],
        answer: "Cell",
      },
      {
        type: "short",
        topic: "Genetics",
        question:
          "What molecule carries genetic information in most organisms?",
        acceptedAnswers: ["dna", "deoxyribonucleic acid"],
      },
      {
        type: "long",
        topic: "Cell Biology",
        question:
          "Explain how structure supports function in one biological organelle of your choice.",
        guidance:
          "Use a developed scientific explanation with correct terminology.",
      },
    ],
  },
  {
    id: "chemistry",
    name: "Chemistry",
    category: "Science",
    description:
      "Atomic theory, chemical bonding, reactions, energy, organic chemistry, and electrochemistry.",
    quiz: [
      {
        type: "mcq",
        topic: "Atomic Theory",
        question: "The atomic number of an element equals:",
        options: [
          "Number of neutrons",
          "Number of protons",
          "Mass number",
          "Number of electrons only",
        ],
        answer: "Number of protons",
      },
      {
        type: "short",
        topic: "Acids & Bases",
        question: "What is the pH of a neutral solution at 25\u00B0C?",
        acceptedAnswers: ["7", "7.0"],
      },
      {
        type: "mcq",
        topic: "Chemical Bonding",
        question: "Which bond involves the sharing of electrons?",
        options: ["Ionic", "Covalent", "Metallic", "Hydrogen"],
        answer: "Covalent",
      },
      {
        type: "short",
        topic: "Chemical Reactions",
        question:
          "What gas is produced when an acid reacts with a carbonate?",
        acceptedAnswers: ["carbon dioxide", "co2"],
      },
      {
        type: "long",
        topic: "Energy & Reactions",
        question:
          "Explain the difference between exothermic and endothermic reactions, with one example of each.",
        guidance:
          "Use correct chemical terminology and relate energy changes to bond breaking and forming.",
      },
    ],
  },
  {
    id: "physics",
    name: "Physics",
    category: "Science",
    description:
      "Motion, forces, energy, electricity, fields, thermodynamics, and quantum physics.",
    quiz: [
      {
        type: "mcq",
        topic: "Forces & Motion",
        question: "Newton's second law states that force equals:",
        options: [
          "mass \u00D7 velocity",
          "mass \u00D7 acceleration",
          "mass \u00D7 distance",
          "velocity / time",
        ],
        answer: "mass \u00D7 acceleration",
      },
      {
        type: "short",
        topic: "Electricity",
        question: "What is the SI unit of electric current?",
        acceptedAnswers: ["ampere", "amp", "a"],
      },
      {
        type: "mcq",
        topic: "Waves",
        question:
          "Which type of wave does not require a medium to travel?",
        options: ["Sound", "Water", "Electromagnetic", "Seismic"],
        answer: "Electromagnetic",
      },
      {
        type: "short",
        topic: "Energy",
        question:
          "State the law of conservation of energy in one sentence.",
        acceptedAnswers: [
          "energy cannot be created or destroyed",
          "energy is conserved",
          "total energy remains constant",
        ],
      },
      {
        type: "long",
        topic: "Forces & Motion",
        question:
          "A car accelerates from rest to 20 m/s in 8 seconds. Calculate its acceleration and the net force if its mass is 1200 kg. Show all working.",
        guidance:
          "Use F = ma and a = \u0394v/\u0394t. Show units at every step.",
      },
    ],
  },
  {
    id: "psychology",
    name: "Psychology",
    category: "Humanities",
    description:
      "Biological, cognitive, and sociocultural approaches to behaviour, consciousness, learning, and mental health.",
    quiz: [
      {
        type: "mcq",
        topic: "Brain & Neuroscience",
        question:
          "The part of the brain most associated with memory formation is the:",
        options: [
          "Cerebellum",
          "Hippocampus",
          "Amygdala",
          "Frontal lobe",
        ],
        answer: "Hippocampus",
      },
      {
        type: "mcq",
        topic: "Learning",
        question: "Classical conditioning was first demonstrated by:",
        options: ["Skinner", "Freud", "Pavlov", "Bandura"],
        answer: "Pavlov",
      },
      {
        type: "short",
        topic: "States of Consciousness",
        question: "What does REM stand for in sleep research?",
        acceptedAnswers: ["rapid eye movement"],
      },
      {
        type: "long",
        topic: "Stress & Physiology",
        question:
          "Explain how the fight-or-flight response is triggered and describe its physiological effects on the body.",
        guidance:
          "Refer to the role of the nervous system and hormones such as adrenaline.",
      },
      {
        type: "mcq",
        topic: "Research Methods",
        question:
          "Which research method best establishes cause and effect?",
        options: ["Case study", "Survey", "Experiment", "Observation"],
        answer: "Experiment",
      },
    ],
  },
  {
    id: "history-revolutions",
    name: "History: Revolutions",
    category: "Humanities",
    description:
      "Causes, course, and consequences of major revolutions including France, Russia, America, and China.",
    quiz: [
      {
        type: "mcq",
        topic: "French Revolution",
        question: "The storming of the Bastille occurred in:",
        options: ["1776", "1789", "1799", "1815"],
        answer: "1789",
      },
      {
        type: "short",
        topic: "Russian Revolution",
        question:
          "Who led the Bolshevik Revolution in Russia in 1917?",
        acceptedAnswers: ["vladimir lenin", "lenin"],
      },
      {
        type: "mcq",
        topic: "American Revolution",
        question: "The Declaration of Independence was signed in:",
        options: ["1773", "1775", "1776", "1781"],
        answer: "1776",
      },
      {
        type: "long",
        topic: "Causes of Revolution",
        question:
          "To what extent were long-term causes more important than short-term causes in bringing about a revolution of your choice?",
        guidance:
          "Construct an argument with a clear contention, at least two long-term and one short-term cause, and a conclusion.",
      },
    ],
  },
  {
    id: "legal-studies",
    name: "Legal Studies",
    category: "Humanities",
    description:
      "The Australian legal system, rights, justice, parliament, courts, and dispute resolution.",
    quiz: [
      {
        type: "mcq",
        topic: "Sources of Law",
        question: "Statute law is law made by:",
        options: [
          "Courts",
          "Parliament",
          "Police",
          "The Governor-General",
        ],
        answer: "Parliament",
      },
      {
        type: "short",
        topic: "Court Hierarchy",
        question: "What is the highest court in Australia?",
        acceptedAnswers: ["high court", "high court of australia"],
      },
      {
        type: "mcq",
        topic: "Rights & Justice",
        question: "The presumption of innocence means:",
        options: [
          "All accused are guilty",
          "The accused is assumed innocent until proven guilty",
          "Evidence is not required",
          "The judge decides without a jury",
        ],
        answer: "The accused is assumed innocent until proven guilty",
      },
      {
        type: "long",
        topic: "Dispute Resolution",
        question:
          "Evaluate the effectiveness of mediation as a method of dispute resolution compared to litigation.",
        guidance:
          "Discuss cost, time, outcomes, and suitability for different types of disputes.",
      },
    ],
  },
  {
    id: "economics",
    name: "Economics",
    category: "Commerce",
    description:
      "Microeconomics, macroeconomics, markets, government policy, globalisation, and the Australian economy.",
    quiz: [
      {
        type: "mcq",
        topic: "Microeconomics",
        question:
          "When price rises and quantity demanded falls, this shows:",
        options: [
          "Elastic supply",
          "The law of demand",
          "A supply shift",
          "Market failure",
        ],
        answer: "The law of demand",
      },
      {
        type: "short",
        topic: "Macroeconomics",
        question: "What does GDP stand for?",
        acceptedAnswers: ["gross domestic product"],
      },
      {
        type: "mcq",
        topic: "Macroeconomics",
        question: "Inflation is best described as:",
        options: [
          "A fall in unemployment",
          "A sustained rise in the general price level",
          "A decrease in exports",
          "A budget surplus",
        ],
        answer: "A sustained rise in the general price level",
      },
      {
        type: "long",
        topic: "Monetary Policy",
        question:
          "Explain how the Reserve Bank of Australia uses interest rates to manage inflation. In your response, discuss both the transmission mechanism and limitations of monetary policy.",
        guidance:
          "Use economic concepts and relevant Australian examples where possible.",
      },
    ],
  },
  {
    id: "accounting",
    name: "Accounting",
    category: "Commerce",
    description:
      "Financial reporting, double-entry bookkeeping, cash flows, balance sheets, and business decision-making.",
    quiz: [
      {
        type: "mcq",
        topic: "Accounting Equation",
        question: "The accounting equation is:",
        options: [
          "Assets = Liabilities + Equity",
          "Revenue = Expenses + Profit",
          "Assets = Revenue - Expenses",
          "Liabilities = Assets + Equity",
        ],
        answer: "Assets = Liabilities + Equity",
      },
      {
        type: "short",
        topic: "Financial Statements",
        question:
          "What financial report shows revenue and expenses for a period?",
        acceptedAnswers: [
          "income statement",
          "profit and loss statement",
          "profit and loss",
        ],
      },
      {
        type: "mcq",
        topic: "Double-Entry Bookkeeping",
        question: "A credit entry in the accounts increases:",
        options: ["Assets", "Expenses", "Liabilities", "Drawings"],
        answer: "Liabilities",
      },
      {
        type: "long",
        topic: "Accounting Methods",
        question:
          "Explain the difference between cash accounting and accrual accounting, and discuss when each would be most appropriate for a small business.",
        guidance:
          "Include examples of how each method records a sale on credit.",
      },
    ],
  },
  {
    id: "business-management",
    name: "Business Management",
    category: "Commerce",
    description:
      "Business planning, management styles, operations, human resources, finance, and change management.",
    quiz: [
      {
        type: "mcq",
        topic: "Business Planning",
        question: "A SWOT analysis examines:",
        options: [
          "Sales, Wages, Operations, Technology",
          "Strengths, Weaknesses, Opportunities, Threats",
          "Strategy, Work, Output, Targets",
          "Staff, Workflow, Outcomes, Training",
        ],
        answer: "Strengths, Weaknesses, Opportunities, Threats",
      },
      {
        type: "short",
        topic: "Management Styles",
        question:
          "What management style involves employees in decision-making?",
        acceptedAnswers: ["participative", "democratic", "consultative"],
      },
      {
        type: "mcq",
        topic: "Human Resources",
        question: "Staff turnover refers to:",
        options: [
          "Training new employees",
          "The rate at which employees leave and are replaced",
          "Promoting staff internally",
          "Annual performance reviews",
        ],
        answer: "The rate at which employees leave and are replaced",
      },
      {
        type: "long",
        topic: "Change Management",
        question:
          "Evaluate the effectiveness of transformational leadership in managing change within a business. Use examples to support your response.",
        guidance:
          "Refer to key features of transformational leadership and contrast with at least one other style.",
      },
    ],
  },
  {
    id: "geography",
    name: "Geography",
    category: "Humanities",
    description:
      "Natural environments, human populations, tourism, globalisation, and geographical inquiry and skills.",
    quiz: [
      {
        type: "mcq",
        topic: "Natural Environments",
        question: "Plate tectonics explains:",
        options: [
          "Weather patterns",
          "Ocean salinity",
          "Movement of Earth's lithospheric plates",
          "River formation",
        ],
        answer: "Movement of Earth's lithospheric plates",
      },
      {
        type: "short",
        topic: "Population",
        question:
          "What term describes the movement of people from rural areas to cities?",
        acceptedAnswers: ["urbanisation", "rural-urban migration"],
      },
      {
        type: "mcq",
        topic: "Resources",
        question: "A renewable resource is one that:",
        options: [
          "Cannot be reused",
          "Replenishes naturally over time",
          "Is found only underground",
          "Is man-made",
        ],
        answer: "Replenishes naturally over time",
      },
      {
        type: "long",
        topic: "Tourism",
        question:
          "To what extent does tourism development bring more benefits than costs to a destination of your choice? Refer to economic, social, and environmental impacts.",
        guidance:
          "Use specific place-based examples and a clear evaluative structure.",
      },
    ],
  },
  {
    id: "further-maths",
    name: "Further Mathematics",
    category: "Mathematics",
    description:
      "Data analysis, recursion and financial modelling, matrices, networks, geometry, and statistics.",
    quiz: [
      {
        type: "mcq",
        topic: "Data Analysis",
        question: "The median of 3, 7, 9, 12, 15 is:",
        options: ["7", "9", "10", "12"],
        answer: "9",
      },
      {
        type: "short",
        topic: "Data Analysis",
        question:
          "What is the name of the graph that displays the five-number summary?",
        acceptedAnswers: [
          "box plot",
          "boxplot",
          "box-and-whisker plot",
          "box and whisker plot",
        ],
      },
      {
        type: "mcq",
        topic: "Financial Modelling",
        question: "Simple interest is calculated using:",
        options: ["I = Prn", "I = P(1 + r)^n", "I = P/rn", "I = P + rn"],
        answer: "I = Prn",
      },
      {
        type: "short",
        topic: "Networks",
        question:
          "In a network graph, what is the term for the number of edges connected to a vertex?",
        acceptedAnswers: ["degree", "valency"],
      },
    ],
  },
  {
    id: "specialist-maths",
    name: "Specialist Mathematics",
    category: "Mathematics",
    description:
      "Complex numbers, vectors, mechanics, advanced calculus, probability distributions, and proof.",
    quiz: [
      {
        type: "mcq",
        topic: "Complex Numbers",
        question: "The modulus of the complex number 3 + 4i is:",
        options: ["3", "4", "5", "7"],
        answer: "5",
      },
      {
        type: "short",
        topic: "Calculus",
        question: "What is the derivative of sin(x)?",
        acceptedAnswers: ["cos(x)", "cos x"],
      },
      {
        type: "mcq",
        topic: "Vectors",
        question: "A vector quantity has:",
        options: [
          "Magnitude only",
          "Direction only",
          "Both magnitude and direction",
          "Neither magnitude nor direction",
        ],
        answer: "Both magnitude and direction",
      },
      {
        type: "long",
        topic: "Proof",
        question:
          "Prove by mathematical induction that the sum of the first n positive integers is n(n+1)/2.",
        guidance:
          "Clearly show the base case, inductive hypothesis, and inductive step.",
      },
    ],
  },
  {
    id: "pe",
    name: "Physical Education",
    category: "Health & PE",
    description:
      "Energy systems, training principles, biomechanics, skill acquisition, and sport science.",
    quiz: [
      {
        type: "mcq",
        topic: "Energy Systems",
        question:
          "The ATP-PC energy system predominantly fuels activities lasting:",
        options: [
          "Under 10 seconds",
          "1\u20133 minutes",
          "More than 20 minutes",
          "Exactly 5 minutes",
        ],
        answer: "Under 10 seconds",
      },
      {
        type: "short",
        topic: "Recovery",
        question:
          "What term describes the body's ability to return to homeostasis after exercise?",
        acceptedAnswers: ["recovery", "post-exercise recovery"],
      },
      {
        type: "mcq",
        topic: "Training Principles",
        question:
          "Which training principle ensures the body is challenged beyond its current level?",
        options: ["Reversibility", "Specificity", "Overload", "Variety"],
        answer: "Overload",
      },
      {
        type: "long",
        topic: "Energy Systems",
        question:
          "Analyse how the aerobic energy system contributes to performance in a sport of your choice. Refer to the role of oxygen and the production of ATP.",
        guidance:
          "Link physiological concepts clearly to the demands of the chosen sport.",
      },
    ],
  },
  {
    id: "health-human-development",
    name: "Health and Human Development",
    category: "Health & PE",
    description:
      "Global health, Australia's health system, health promotion, dimensions of health, and the SDGs.",
    quiz: [
      {
        type: "mcq",
        topic: "Dimensions of Health",
        question:
          "The five dimensions of health are physical, social, emotional, mental, and:",
        options: ["Cultural", "Spiritual", "Economic", "Environmental"],
        answer: "Spiritual",
      },
      {
        type: "short",
        topic: "Global Health",
        question: "What does WHO stand for?",
        acceptedAnswers: [
          "world health organization",
          "world health organisation",
        ],
      },
      {
        type: "mcq",
        topic: "Health Promotion",
        question: "Primary prevention in health refers to:",
        options: [
          "Treating existing illness",
          "Early detection of disease",
          "Preventing disease before it occurs",
          "Rehabilitation after illness",
        ],
        answer: "Preventing disease before it occurs",
      },
      {
        type: "long",
        topic: "Health Promotion",
        question:
          "Explain how the Ottawa Charter's action areas can be applied to reduce rates of type 2 diabetes in Australia.",
        guidance:
          "Refer to at least three action areas with specific examples.",
      },
    ],
  },
  {
    id: "music",
    name: "Music Performance",
    category: "Arts",
    description:
      "Musicianship, performance practice, music theory, aural skills, and music history.",
    quiz: [
      {
        type: "mcq",
        topic: "Music Theory",
        question: "A time signature of 3/4 means:",
        options: [
          "3 beats per bar, quarter note gets one beat",
          "4 beats per bar, dotted quarter gets one beat",
          "3 eighth notes per bar",
          "4 beats with triplet feel",
        ],
        answer: "3 beats per bar, quarter note gets one beat",
      },
      {
        type: "short",
        topic: "Music Theory",
        question:
          "What Italian term indicates a gradual increase in speed?",
        acceptedAnswers: ["accelerando", "accel"],
      },
      {
        type: "mcq",
        topic: "Music Theory",
        question: "A semitone is:",
        options: [
          "Two whole steps",
          "The smallest interval in Western music",
          "A half note",
          "A type of scale",
        ],
        answer: "The smallest interval in Western music",
      },
    ],
  },
  {
    id: "studio-arts",
    name: "Studio Arts",
    category: "Arts",
    description:
      "Art practice, the folio, studio processes, art theories, and critical analysis of artworks.",
    quiz: [
      {
        type: "mcq",
        topic: "Studio Folio",
        question: "A studio folio in VCE Studio Arts documents:",
        options: [
          "Only final artworks",
          "The full creative process from exploration to resolution",
          "Research essays only",
          "Art history notes",
        ],
        answer:
          "The full creative process from exploration to resolution",
      },
      {
        type: "short",
        topic: "Visual Elements",
        question:
          "What term describes the arrangement of visual elements in an artwork?",
        acceptedAnswers: ["composition"],
      },
      {
        type: "long",
        topic: "Art Analysis",
        question:
          "Analyse how an artist of your choice has used materials and techniques to convey meaning in one of their works.",
        guidance:
          "Use formal analysis language and reference specific visual elements and principles.",
      },
    ],
  },
  {
    id: "environmental-science",
    name: "Environmental Science",
    category: "Science",
    description:
      "Ecosystems, biodiversity, climate change, pollution, resource management, and sustainability.",
    quiz: [
      {
        type: "mcq",
        topic: "Climate Change",
        question: "The greenhouse effect is caused by:",
        options: [
          "Ozone depletion",
          "Greenhouse gases trapping heat in the atmosphere",
          "Ocean acidification only",
          "Solar flares",
        ],
        answer: "Greenhouse gases trapping heat in the atmosphere",
      },
      {
        type: "short",
        topic: "Biodiversity",
        question:
          "What term describes the variety of life in a given area?",
        acceptedAnswers: ["biodiversity"],
      },
      {
        type: "mcq",
        topic: "Ecosystems",
        question: "A keystone species is one that:",
        options: [
          "Is the largest in an ecosystem",
          "Has a disproportionately large effect on its ecosystem",
          "Is endangered",
          "Migrates seasonally",
        ],
        answer:
          "Has a disproportionately large effect on its ecosystem",
      },
      {
        type: "long",
        topic: "Environmental Management",
        question:
          "Evaluate the effectiveness of two strategies used to manage a specific environmental issue such as land degradation or water pollution.",
        guidance:
          "Include both advantages and limitations of each strategy and use real-world examples.",
      },
    ],
  },
  {
    id: "sociology",
    name: "Sociology",
    category: "Humanities",
    description:
      "Social structures, culture, inequality, institutions, and sociological theory.",
    quiz: [
      {
        type: "mcq",
        topic: "Socialisation",
        question: "Socialisation refers to:",
        options: [
          "Making friends",
          "The process by which individuals learn social norms and values",
          "Government policy",
          "Economic mobility",
        ],
        answer:
          "The process by which individuals learn social norms and values",
      },
      {
        type: "short",
        topic: "Sociological Theory",
        question:
          "What sociologist introduced the concept of the 'sociological imagination'?",
        acceptedAnswers: ["c wright mills", "mills"],
      },
      {
        type: "long",
        topic: "Inequality",
        question:
          "Using sociological concepts, explain how social class influences educational outcomes. Refer to at least one theoretical perspective.",
        guidance:
          "Consider cultural capital, structural factors, and relevant evidence.",
      },
    ],
  },
  {
    id: "it-applications",
    name: "Information Technology Applications",
    category: "Technology",
    description:
      "Databases, spreadsheets, user interface design, project management, and digital solutions.",
    quiz: [
      {
        type: "mcq",
        topic: "Databases",
        question: "A primary key in a database table:",
        options: [
          "Can contain duplicate values",
          "Uniquely identifies each record",
          "Is always a number",
          "Links to another table",
        ],
        answer: "Uniquely identifies each record",
      },
      {
        type: "short",
        topic: "Databases",
        question: "What does SQL stand for?",
        acceptedAnswers: ["structured query language"],
      },
      {
        type: "mcq",
        topic: "Databases",
        question:
          "Which of the following is an example of validation in a database?",
        options: [
          "Encrypting data",
          "Checking that an entered date is in the correct format",
          "Backing up data",
          "Sorting records",
        ],
        answer:
          "Checking that an entered date is in the correct format",
      },
      {
        type: "long",
        topic: "Systems Development",
        question:
          "Describe the phases of a systems development life cycle (SDLC) and explain why each phase is important in delivering a quality digital solution.",
        guidance:
          "Cover at least four phases with examples of activities within each.",
      },
    ],
  },
  {
    id: "software-development",
    name: "Software Development",
    category: "Technology",
    description:
      "Programming, algorithms, data structures, software design, testing, and project management.",
    quiz: [
      {
        type: "mcq",
        topic: "Data Structures",
        question:
          "Which data structure operates on a Last-In, First-Out basis?",
        options: ["Queue", "Stack", "Array", "Linked list"],
        answer: "Stack",
      },
      {
        type: "short",
        topic: "Programming",
        question:
          "What is the term for finding and fixing errors in code?",
        acceptedAnswers: ["debugging"],
      },
      {
        type: "mcq",
        topic: "Algorithms",
        question:
          "An algorithm that sorts a list by repeatedly swapping adjacent elements is called:",
        options: [
          "Merge sort",
          "Selection sort",
          "Bubble sort",
          "Binary sort",
        ],
        answer: "Bubble sort",
      },
      {
        type: "long",
        topic: "Testing",
        question:
          "Explain the difference between white-box and black-box testing. When would each be used in a software project?",
        guidance:
          "Include definitions, examples of test cases for each type, and a comparison.",
      },
    ],
  },
  {
    id: "media",
    name: "Media",
    category: "Arts",
    description:
      "Media production, media texts, representation, audience, narrative, and media industries.",
    quiz: [
      {
        type: "mcq",
        topic: "Media Language",
        question: "The term \u2018mise-en-sc\u00E8ne\u2019 refers to:",
        options: [
          "Sound editing",
          "Everything visible within the frame of a shot",
          "The film's screenplay",
          "Post-production colour grading",
        ],
        answer: "Everything visible within the frame of a shot",
      },
      {
        type: "short",
        topic: "Media Language",
        question:
          "What is the name for a camera shot that shows a character from the waist up?",
        acceptedAnswers: ["medium shot", "mid shot"],
      },
      {
        type: "long",
        topic: "Representation",
        question:
          "Analyse how a media text of your choice constructs a representation of a particular social group. Refer to specific media codes and conventions.",
        guidance:
          "Use the language of media analysis and refer to at least three codes or conventions.",
      },
    ],
  },
  {
    id: "politics",
    name: "Australian and Global Politics",
    category: "Humanities",
    description:
      "Australian government, global actors, international relations, human rights, and power.",
    quiz: [
      {
        type: "mcq",
        topic: "Australian Government",
        question:
          "Australia's system of government is best described as a:",
        options: [
          "Presidential republic",
          "Constitutional monarchy and federal parliamentary democracy",
          "Unitary state",
          "Autocracy",
        ],
        answer:
          "Constitutional monarchy and federal parliamentary democracy",
      },
      {
        type: "short",
        topic: "Global Institutions",
        question:
          "What body is the primary organ of the United Nations responsible for international peace and security?",
        acceptedAnswers: ["security council", "un security council"],
      },
      {
        type: "mcq",
        topic: "Global Politics",
        question: "The concept of state sovereignty means:",
        options: [
          "Citizens have supreme power",
          "A state has supreme authority within its borders",
          "The military controls government",
          "International law overrides domestic law",
        ],
        answer: "A state has supreme authority within its borders",
      },
      {
        type: "long",
        topic: "Non-State Actors",
        question:
          "To what extent do non-state actors challenge the power of nation-states in global politics? Use specific examples to support your argument.",
        guidance:
          "Consider at least two types of non-state actors and evaluate their influence.",
      },
    ],
  },
];
