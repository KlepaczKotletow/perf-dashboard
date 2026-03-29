import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Lock } from "lucide-react";
import { isManagerOrAbove } from "@/lib/roles";
import TemplatesClient from "./templates-client";

// ── System Review Templates ─────────────────────────────────────────────────

const SYSTEM_REVIEW_TEMPLATES = [
  {
    name: "Annual Performance Review",
    description: "Comprehensive yearly performance evaluation covering leadership, communication, execution, and growth.",
    questions: [
      { id: "sys-1-1", type: "rating", text: "Leadership: Demonstrates initiative and guides others effectively", required: true },
      { id: "sys-1-2", type: "rating", text: "Communication: Expresses ideas clearly and listens actively", required: true },
      { id: "sys-1-3", type: "rating", text: "Execution: Delivers quality work on time and meets objectives", required: true },
      { id: "sys-1-4", type: "rating", text: "Collaboration: Works effectively with team members across the organization", required: true },
      { id: "sys-1-5", type: "rating", text: "Innovation: Proposes creative solutions and embraces new approaches", required: true },
      { id: "sys-1-6", type: "text", text: "What are this person's most significant accomplishments this year?", required: true },
      { id: "sys-1-7", type: "text", text: "What areas should this person focus on for growth?", required: true },
    ],
  },
  {
    name: "Mid-Year Check-in",
    description: "Lightweight mid-year review to assess progress and identify support needs.",
    questions: [
      { id: "sys-2-1", type: "rating", text: "Goal Progress: On track to meet annual goals and objectives", required: true },
      { id: "sys-2-2", type: "rating", text: "Collaboration: Contributes positively to team dynamics", required: true },
      { id: "sys-2-3", type: "rating", text: "Initiative: Proactively identifies and acts on opportunities", required: true },
      { id: "sys-2-4", type: "text", text: "What is going well so far this year?", required: true },
      { id: "sys-2-5", type: "text", text: "What support do you need to succeed in the second half?", required: true },
    ],
  },
  {
    name: "90-Day Probation Review",
    description: "Structured evaluation for new hires completing their probationary period.",
    questions: [
      { id: "sys-3-1", type: "rating", text: "Role Fit: Demonstrates the skills and aptitude required for the role", required: true },
      { id: "sys-3-2", type: "rating", text: "Learning Agility: Quickly absorbs new information and adapts to processes", required: true },
      { id: "sys-3-3", type: "rating", text: "Team Integration: Builds productive relationships with colleagues", required: true },
      { id: "sys-3-4", type: "rating", text: "Work Quality: Produces accurate, thorough work that meets expectations", required: true },
      { id: "sys-3-5", type: "text", text: "How has this person adapted to the team and role?", required: true },
      { id: "sys-3-6", type: "text", text: "Do you recommend continuing employment? Please explain.", required: true },
    ],
  },
  {
    name: "Quarterly Pulse",
    description: "Quick quarterly check-in to gauge engagement, workload, and manager support.",
    questions: [
      { id: "sys-4-1", type: "rating", text: "Engagement: Feels motivated and connected to the team's mission", required: true },
      { id: "sys-4-2", type: "rating", text: "Workload Balance: Has a manageable and sustainable workload", required: true },
      { id: "sys-4-3", type: "rating", text: "Manager Support: Receives adequate guidance and support from their manager", required: true },
      { id: "sys-4-4", type: "text", text: "What should we start, stop, or continue doing as a team?", required: true },
    ],
  },
  {
    name: "Manager Effectiveness",
    description: "Upward feedback template for evaluating manager performance and leadership.",
    questions: [
      { id: "sys-5-1", type: "rating", text: "Clear Communication: Communicates expectations, decisions, and context clearly", required: true },
      { id: "sys-5-2", type: "rating", text: "Provides Feedback: Gives timely, constructive, and actionable feedback", required: true },
      { id: "sys-5-3", type: "rating", text: "Supports Growth: Actively invests in team members' development and career growth", required: true },
      { id: "sys-5-4", type: "rating", text: "Sets Direction: Provides clear priorities and removes blockers for the team", required: true },
      { id: "sys-5-5", type: "text", text: "What does this manager do particularly well?", required: true },
      { id: "sys-5-6", type: "text", text: "How could this manager improve their effectiveness?", required: true },
    ],
  },
  {
    name: "Peer Feedback",
    description: "Peer-to-peer review template focused on collaboration, reliability, and communication.",
    questions: [
      { id: "sys-6-1", type: "rating", text: "Collaboration: Works well with others and contributes to shared goals", required: true },
      { id: "sys-6-2", type: "rating", text: "Reliability: Follows through on commitments and can be counted on", required: true },
      { id: "sys-6-3", type: "rating", text: "Communication: Communicates effectively and keeps others informed", required: true },
      { id: "sys-6-4", type: "text", text: "What is this person's biggest strength as a colleague?", required: true },
      { id: "sys-6-5", type: "text", text: "What is one suggestion you have for this person?", required: true },
    ],
  },
];

// ── System Competency Frameworks ────────────────────────────────────────────

const SYSTEM_COMPETENCY_FRAMEWORKS = [
  {
    name: "Engineering Ladder",
    description: "Technical career framework for software engineers covering coding, architecture, and leadership skills.",
    content: {
      competencies: [
        {
          name: "Technical Excellence",
          description: "Depth and breadth of technical knowledge",
          category: "Technical",
          is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Writes clean code with guidance", "Follows established patterns and conventions"] },
            "2": { title: "Mid", indicators: ["Designs simple features independently", "Reviews code effectively and provides constructive feedback"] },
            "3": { title: "Senior", indicators: ["Architects complex systems with minimal oversight", "Mentors others on best practices and technical standards"] },
            "4": { title: "Staff", indicators: ["Drives technical strategy across multiple teams", "Solves novel technical challenges that impact the organization"] },
            "5": { title: "Principal", indicators: ["Sets company-wide technical direction and standards", "Industry-recognized expertise in key technical domains"] },
          },
        },
        {
          name: "Systems Design",
          description: "Ability to design scalable, reliable, and maintainable systems",
          category: "Technical",
          is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Understands basic system components and their interactions", "Follows existing design patterns in implementations"] },
            "2": { title: "Mid", indicators: ["Designs straightforward services with appropriate trade-offs", "Considers scalability and performance in design decisions"] },
            "3": { title: "Senior", indicators: ["Designs complex distributed systems end-to-end", "Evaluates and selects appropriate technologies for new projects"] },
            "4": { title: "Staff", indicators: ["Defines system architecture for large-scale platform initiatives", "Drives cross-team alignment on system boundaries and contracts"] },
            "5": { title: "Principal", indicators: ["Shapes the overall technical architecture of the organization", "Anticipates industry trends and evolves systems proactively"] },
          },
        },
        {
          name: "Code Quality",
          description: "Writing maintainable, tested, and well-documented code",
          category: "Technical",
          is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Writes readable code that passes code review", "Adds basic tests for new functionality"] },
            "2": { title: "Mid", indicators: ["Produces well-structured code with comprehensive test coverage", "Refactors existing code to improve clarity and maintainability"] },
            "3": { title: "Senior", indicators: ["Establishes coding standards and review guidelines for the team", "Designs testing strategies that catch regressions early"] },
            "4": { title: "Staff", indicators: ["Drives adoption of quality practices across multiple teams", "Creates tooling and automation to enforce code quality at scale"] },
            "5": { title: "Principal", indicators: ["Defines organization-wide engineering excellence standards", "Pioneers new approaches to software quality and reliability"] },
          },
        },
        {
          name: "Debugging & Problem Solving",
          description: "Diagnosing and resolving complex technical issues efficiently",
          category: "Technical",
          is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Debugs straightforward issues using logs and standard tools", "Asks targeted questions to narrow down root causes"] },
            "2": { title: "Mid", indicators: ["Diagnoses issues across multiple system components", "Uses profiling and monitoring tools to identify performance bottlenecks"] },
            "3": { title: "Senior", indicators: ["Resolves complex production incidents under pressure", "Builds debugging frameworks and runbooks for the team"] },
            "4": { title: "Staff", indicators: ["Leads incident response for critical system-wide outages", "Identifies systemic patterns and drives long-term reliability improvements"] },
            "5": { title: "Principal", indicators: ["Creates organizational incident response processes and culture", "Develops novel diagnostic approaches for unprecedented technical challenges"] },
          },
        },
        {
          name: "Architecture",
          description: "Making sound architectural decisions that balance current needs with future growth",
          category: "Technical",
          is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Understands the high-level architecture of the codebase", "Implements features within the existing architectural framework"] },
            "2": { title: "Mid", indicators: ["Proposes architectural improvements for their area of ownership", "Documents architectural decisions and their trade-offs"] },
            "3": { title: "Senior", indicators: ["Leads architectural design for new product areas", "Balances technical debt reduction with feature delivery"] },
            "4": { title: "Staff", indicators: ["Defines architectural principles that guide the engineering organization", "Drives migration strategies for large-scale system evolution"] },
            "5": { title: "Principal", indicators: ["Sets the long-term technical vision for the entire platform", "Influences industry standards through architectural innovation"] },
          },
        },
        {
          name: "Mentoring & Knowledge Sharing",
          description: "Growing others and building team capabilities through teaching and guidance",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Shares learnings with teammates in team meetings", "Documents solutions to common problems for the team wiki"] },
            "2": { title: "Mid", indicators: ["Onboards new team members effectively", "Gives constructive feedback in code reviews that helps others grow"] },
            "3": { title: "Senior", indicators: ["Mentors junior and mid-level engineers on technical growth", "Creates learning resources and leads technical workshops"] },
            "4": { title: "Staff", indicators: ["Builds mentorship programs that scale across the organization", "Develops talent pipelines and identifies future technical leaders"] },
            "5": { title: "Principal", indicators: ["Shapes the engineering culture around continuous learning", "Contributes to the broader engineering community through talks and publications"] },
          },
        },
        {
          name: "Project Ownership",
          description: "Driving projects from conception to delivery with accountability",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Completes assigned tasks on time and communicates blockers", "Participates actively in sprint planning and standups"] },
            "2": { title: "Mid", indicators: ["Owns delivery of features end-to-end including testing and rollout", "Identifies risks early and proposes mitigation strategies"] },
            "3": { title: "Senior", indicators: ["Leads complex multi-sprint projects with cross-team dependencies", "Balances scope, quality, and timeline trade-offs effectively"] },
            "4": { title: "Staff", indicators: ["Drives organization-level initiatives spanning multiple quarters", "Aligns engineering efforts with business strategy and outcomes"] },
            "5": { title: "Principal", indicators: ["Sponsors and shapes the most critical technical programs in the company", "Ensures engineering investments deliver measurable business impact"] },
          },
        },
        {
          name: "Communication",
          description: "Expressing ideas clearly and collaborating effectively across teams",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Communicates status updates clearly to the team", "Asks thoughtful questions and actively listens in discussions"] },
            "2": { title: "Mid", indicators: ["Writes clear technical documents and proposals", "Facilitates productive discussions within the team"] },
            "3": { title: "Senior", indicators: ["Communicates complex technical concepts to non-technical stakeholders", "Drives alignment across teams through effective written and verbal communication"] },
            "4": { title: "Staff", indicators: ["Represents engineering in cross-functional leadership discussions", "Crafts narratives that build support for technical initiatives"] },
            "5": { title: "Principal", indicators: ["Communicates technical vision to the entire organization and external audiences", "Influences company strategy through compelling technical storytelling"] },
          },
        },
      ],
    },
  },
  {
    name: "Product Management",
    description: "Career framework for product managers covering strategy, execution, and stakeholder management.",
    content: {
      competencies: [
        {
          name: "Product Strategy",
          description: "Defining product vision, roadmap, and competitive positioning",
          category: "Strategic",
          is_core: false,
          levels: {
            "1": { title: "Junior PM", indicators: ["Understands the product roadmap and can articulate priorities", "Conducts competitive research to inform feature decisions"] },
            "2": { title: "PM", indicators: ["Develops feature-level strategies aligned with product goals", "Identifies market opportunities through customer and data analysis"] },
            "3": { title: "Senior PM", indicators: ["Owns product strategy for a major product area", "Makes strategic bets that create competitive differentiation"] },
            "4": { title: "Director", indicators: ["Defines multi-year product vision across a portfolio", "Influences company strategy through product-led insights"] },
            "5": { title: "VP", indicators: ["Sets the overall product direction for the organization", "Shapes market categories through visionary product thinking"] },
          },
        },
        {
          name: "User Empathy",
          description: "Deeply understanding user needs, pain points, and behaviors",
          category: "Strategic",
          is_core: false,
          levels: {
            "1": { title: "Junior PM", indicators: ["Participates in user research sessions and summarizes findings", "Uses existing personas to guide feature requirements"] },
            "2": { title: "PM", indicators: ["Conducts user interviews and translates insights into requirements", "Advocates for user needs in prioritization discussions"] },
            "3": { title: "Senior PM", indicators: ["Designs research programs that uncover latent user needs", "Builds deep empathy maps that drive product innovation"] },
            "4": { title: "Director", indicators: ["Creates a user-centric culture across product and engineering teams", "Connects user insights to business strategy and growth levers"] },
            "5": { title: "VP", indicators: ["Champions user advocacy at the executive and board level", "Transforms organizational decision-making to be user-first"] },
          },
        },
        {
          name: "Data-Driven Decisions",
          description: "Using quantitative and qualitative data to inform product choices",
          category: "Technical",
          is_core: false,
          levels: {
            "1": { title: "Junior PM", indicators: ["Tracks key metrics and reports on product performance", "Uses dashboards and analytics tools to answer basic questions"] },
            "2": { title: "PM", indicators: ["Designs experiments and A/B tests to validate hypotheses", "Synthesizes data from multiple sources to drive decisions"] },
            "3": { title: "Senior PM", indicators: ["Builds measurement frameworks for complex product initiatives", "Identifies leading indicators that predict business outcomes"] },
            "4": { title: "Director", indicators: ["Establishes data governance and analytics strategy for the product org", "Drives organizational adoption of data-informed decision-making"] },
            "5": { title: "VP", indicators: ["Sets company-wide product analytics standards and KPIs", "Leverages data to shape long-term strategic direction"] },
          },
        },
        {
          name: "Execution & Delivery",
          description: "Shipping products on time with quality through effective project management",
          category: "Technical",
          is_core: false,
          levels: {
            "1": { title: "Junior PM", indicators: ["Writes clear user stories and acceptance criteria", "Keeps the backlog organized and sprint goals on track"] },
            "2": { title: "PM", indicators: ["Manages end-to-end delivery of features from spec to launch", "Navigates scope trade-offs to meet deadlines without sacrificing quality"] },
            "3": { title: "Senior PM", indicators: ["Coordinates complex cross-team launches with multiple dependencies", "Builds repeatable processes that accelerate time-to-market"] },
            "4": { title: "Director", indicators: ["Optimizes delivery processes across the entire product organization", "Balances innovation investments with operational efficiency"] },
            "5": { title: "VP", indicators: ["Drives organizational excellence in product delivery at scale", "Creates frameworks that align execution speed with strategic priorities"] },
          },
        },
        {
          name: "Stakeholder Management",
          description: "Building alignment and managing expectations across the organization",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "Junior PM", indicators: ["Communicates product updates clearly to immediate stakeholders", "Gathers requirements from internal teams effectively"] },
            "2": { title: "PM", indicators: ["Manages competing stakeholder priorities with transparency", "Builds trust through consistent delivery and communication"] },
            "3": { title: "Senior PM", indicators: ["Navigates complex organizational dynamics to drive alignment", "Influences senior leaders to support product initiatives"] },
            "4": { title: "Director", indicators: ["Manages executive-level expectations across business units", "Builds coalitions that enable large-scale organizational change"] },
            "5": { title: "VP", indicators: ["Represents product perspective in board and investor discussions", "Shapes company culture around customer-centricity and innovation"] },
          },
        },
        {
          name: "Technical Fluency",
          description: "Understanding technology well enough to make informed product decisions",
          category: "Technical",
          is_core: false,
          levels: {
            "1": { title: "Junior PM", indicators: ["Understands basic software development concepts and workflows", "Communicates with engineers using appropriate technical terminology"] },
            "2": { title: "PM", indicators: ["Evaluates technical trade-offs and their impact on product timelines", "Participates meaningfully in architecture and design discussions"] },
            "3": { title: "Senior PM", indicators: ["Leverages deep technical understanding to identify innovative solutions", "Partners with engineering to make sound build-vs-buy decisions"] },
            "4": { title: "Director", indicators: ["Guides technical strategy discussions at the product-engineering interface", "Anticipates how technology trends will reshape product opportunities"] },
            "5": { title: "VP", indicators: ["Shapes technology investment strategy alongside engineering leadership", "Drives product innovation through emerging technology adoption"] },
          },
        },
      ],
    },
  },
  {
    name: "People Management",
    description: "Leadership framework for managers focusing on team development, performance, and organizational health.",
    content: {
      competencies: [
        {
          name: "Team Development",
          description: "Growing team members' skills, careers, and engagement",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "New Manager", indicators: ["Holds regular 1:1s and provides basic coaching", "Identifies development areas for each direct report"] },
            "2": { title: "Manager", indicators: ["Creates individualized growth plans aligned with career goals", "Provides opportunities for stretch assignments and skill building"] },
            "3": { title: "Senior Manager", indicators: ["Builds a high-performing team culture that attracts top talent", "Develops future leaders through structured mentorship programs"] },
            "4": { title: "Director", indicators: ["Designs talent development strategy across multiple teams", "Creates succession plans that ensure organizational continuity"] },
            "5": { title: "VP", indicators: ["Shapes company-wide learning and development programs", "Builds an organizational culture that continuously develops talent at all levels"] },
          },
        },
        {
          name: "Performance Management",
          description: "Setting expectations, providing feedback, and driving accountability",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "New Manager", indicators: ["Sets clear goals and expectations for direct reports", "Delivers timely feedback on both strengths and areas for improvement"] },
            "2": { title: "Manager", indicators: ["Conducts fair and thorough performance reviews", "Addresses underperformance promptly with structured improvement plans"] },
            "3": { title: "Senior Manager", indicators: ["Calibrates performance standards consistently across the team", "Links individual performance to team and business outcomes"] },
            "4": { title: "Director", indicators: ["Designs performance management processes for the department", "Drives accountability culture while maintaining psychological safety"] },
            "5": { title: "VP", indicators: ["Sets organizational performance philosophy and standards", "Creates systems that reward high performance and address low performance at scale"] },
          },
        },
        {
          name: "Strategic Thinking",
          description: "Translating business goals into team-level plans and priorities",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "New Manager", indicators: ["Understands how team goals connect to department objectives", "Prioritizes team work to align with organizational strategy"] },
            "2": { title: "Manager", indicators: ["Develops team strategies that advance department-level goals", "Anticipates market or organizational changes that affect the team"] },
            "3": { title: "Senior Manager", indicators: ["Shapes department strategy and influences cross-functional priorities", "Balances short-term execution with long-term strategic investments"] },
            "4": { title: "Director", indicators: ["Drives multi-year strategic planning for a business area", "Identifies strategic partnerships and opportunities that create competitive advantage"] },
            "5": { title: "VP", indicators: ["Shapes company-wide strategy as part of the executive team", "Positions the organization for long-term success in a changing market"] },
          },
        },
        {
          name: "Communication & Transparency",
          description: "Keeping the team informed, aligned, and psychologically safe",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "New Manager", indicators: ["Shares relevant context and decisions with the team promptly", "Creates a safe environment for team members to ask questions"] },
            "2": { title: "Manager", indicators: ["Translates organizational decisions into clear team-level implications", "Facilitates open discussions about challenges and trade-offs"] },
            "3": { title: "Senior Manager", indicators: ["Communicates difficult messages with empathy and clarity", "Builds trust through consistent transparency even in uncertain times"] },
            "4": { title: "Director", indicators: ["Crafts organizational narratives that inspire and align large teams", "Creates communication frameworks that scale across the department"] },
            "5": { title: "VP", indicators: ["Represents the organization in company-wide communications and town halls", "Sets the standard for transparent leadership across the company"] },
          },
        },
        {
          name: "Conflict Resolution",
          description: "Navigating interpersonal and team conflicts constructively",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "New Manager", indicators: ["Addresses minor team conflicts before they escalate", "Listens to all perspectives and facilitates fair resolutions"] },
            "2": { title: "Manager", indicators: ["Mediates complex interpersonal disagreements effectively", "Creates team norms that reduce friction and misunderstandings"] },
            "3": { title: "Senior Manager", indicators: ["Resolves cross-team conflicts that impact organizational effectiveness", "Coaches other managers on conflict resolution techniques"] },
            "4": { title: "Director", indicators: ["Navigates politically sensitive conflicts at the department level", "Builds organizational processes that surface and resolve conflicts early"] },
            "5": { title: "VP", indicators: ["Resolves executive-level disagreements that affect company direction", "Creates an organizational culture that embraces healthy conflict as a growth mechanism"] },
          },
        },
        {
          name: "Hiring & Talent",
          description: "Attracting, selecting, and retaining top talent for the team",
          category: "Leadership",
          is_core: false,
          levels: {
            "1": { title: "New Manager", indicators: ["Conducts structured interviews and provides calibrated assessments", "Writes compelling job descriptions that attract qualified candidates"] },
            "2": { title: "Manager", indicators: ["Builds a strong talent pipeline through networking and referrals", "Makes sound hiring decisions that improve team capability and diversity"] },
            "3": { title: "Senior Manager", indicators: ["Designs interview processes that consistently identify top talent", "Develops employer branding strategies that attract passive candidates"] },
            "4": { title: "Director", indicators: ["Creates talent acquisition strategies aligned with growth plans", "Builds organizational capability through strategic workforce planning"] },
            "5": { title: "VP", indicators: ["Shapes the company's employer brand and talent philosophy", "Drives industry-leading retention through culture and career development programs"] },
          },
        },
      ],
    },
  },
  {
    name: "General (SHRM-style)",
    description: "Universal competency framework based on SHRM principles, applicable across all roles and departments.",
    content: {
      competencies: [
        {
          name: "Communication",
          description: "Exchanging information effectively through verbal, written, and active listening skills",
          category: "Core",
          is_core: true,
          levels: {
            "1": { title: "Foundational", indicators: ["Expresses ideas clearly in routine conversations and emails", "Listens attentively and asks clarifying questions"] },
            "2": { title: "Developing", indicators: ["Adapts communication style to different audiences", "Writes clear documentation and proposals"] },
            "3": { title: "Proficient", indicators: ["Presents complex information persuasively to diverse stakeholders", "Facilitates productive meetings and discussions"] },
            "4": { title: "Advanced", indicators: ["Communicates strategic vision that inspires action across teams", "Navigates sensitive conversations with empathy and diplomacy"] },
            "5": { title: "Expert", indicators: ["Represents the organization in high-stakes external communications", "Shapes organizational communication culture and standards"] },
          },
        },
        {
          name: "Problem Solving",
          description: "Analyzing challenges and developing effective, creative solutions",
          category: "Core",
          is_core: true,
          levels: {
            "1": { title: "Foundational", indicators: ["Identifies problems and gathers relevant information", "Applies standard procedures to solve routine challenges"] },
            "2": { title: "Developing", indicators: ["Analyzes root causes and evaluates multiple solution options", "Proposes practical solutions that consider impact and feasibility"] },
            "3": { title: "Proficient", indicators: ["Solves complex problems that span multiple domains or teams", "Develops frameworks that help others approach problems systematically"] },
            "4": { title: "Advanced", indicators: ["Tackles ambiguous challenges with innovative approaches", "Anticipates problems before they occur and implements preventive measures"] },
            "5": { title: "Expert", indicators: ["Solves organizational-level challenges that define strategic direction", "Creates a culture of continuous improvement and creative problem solving"] },
          },
        },
        {
          name: "Teamwork & Collaboration",
          description: "Working effectively with others to achieve shared goals",
          category: "Core",
          is_core: true,
          levels: {
            "1": { title: "Foundational", indicators: ["Contributes reliably to team deliverables and meetings", "Supports teammates and shares information willingly"] },
            "2": { title: "Developing", indicators: ["Collaborates across functions to deliver joint outcomes", "Actively seeks input from diverse perspectives"] },
            "3": { title: "Proficient", indicators: ["Builds effective working relationships across the organization", "Resolves team conflicts and fosters a collaborative environment"] },
            "4": { title: "Advanced", indicators: ["Creates collaborative structures that break down organizational silos", "Enables high-performing teams through trust and shared accountability"] },
            "5": { title: "Expert", indicators: ["Drives organization-wide collaboration on strategic initiatives", "Builds a culture where cross-functional teamwork is the norm"] },
          },
        },
        {
          name: "Leadership",
          description: "Influencing, guiding, and enabling others to achieve their best",
          category: "Core",
          is_core: true,
          levels: {
            "1": { title: "Foundational", indicators: ["Takes initiative on tasks without being asked", "Supports team decisions and contributes positively to morale"] },
            "2": { title: "Developing", indicators: ["Guides small projects or task groups to successful outcomes", "Provides constructive feedback that helps others improve"] },
            "3": { title: "Proficient", indicators: ["Leads teams through change and ambiguity with confidence", "Develops others by sharing expertise and providing growth opportunities"] },
            "4": { title: "Advanced", indicators: ["Inspires large teams to deliver exceptional results", "Builds leadership capability in others through coaching and delegation"] },
            "5": { title: "Expert", indicators: ["Sets the leadership standard for the entire organization", "Drives transformational change that shapes the company's future"] },
          },
        },
        {
          name: "Adaptability",
          description: "Adjusting to new situations, technologies, and changing priorities",
          category: "Core",
          is_core: true,
          levels: {
            "1": { title: "Foundational", indicators: ["Accepts change positively and adjusts work approach accordingly", "Learns new tools and processes when required"] },
            "2": { title: "Developing", indicators: ["Proactively seeks out new methods to improve effectiveness", "Maintains productivity during periods of uncertainty"] },
            "3": { title: "Proficient", indicators: ["Champions change initiatives and helps others adapt", "Thrives in ambiguous situations and finds productive paths forward"] },
            "4": { title: "Advanced", indicators: ["Leads organizational change with clear communication and support", "Anticipates industry shifts and positions the team for success"] },
            "5": { title: "Expert", indicators: ["Drives company-wide transformation and innovation initiatives", "Creates an agile, learning organization that embraces continuous change"] },
          },
        },
        {
          name: "Results Orientation",
          description: "Focusing on outcomes and driving consistent, high-quality delivery",
          category: "Core",
          is_core: true,
          levels: {
            "1": { title: "Foundational", indicators: ["Meets deadlines and quality standards consistently", "Takes ownership of assigned work and follows through to completion"] },
            "2": { title: "Developing", indicators: ["Sets ambitious personal goals and tracks progress methodically", "Identifies and removes obstacles to improve delivery speed"] },
            "3": { title: "Proficient", indicators: ["Drives team results that exceed expectations quarter over quarter", "Balances quality, speed, and resource efficiency in delivery"] },
            "4": { title: "Advanced", indicators: ["Sets stretch goals that push the organization to new performance levels", "Creates measurement systems that align effort with business impact"] },
            "5": { title: "Expert", indicators: ["Defines what excellence looks like for the entire organization", "Builds a high-performance culture that sustains exceptional results over time"] },
          },
        },
      ],
    },
  },
  // ── Sales & Business Development ──
  {
    name: "Sales & Business Development",
    description: "Career framework for sales professionals covering pipeline management, negotiation, and account growth.",
    content: {
      competencies: [
        {
          name: "Pipeline Management", description: "Building and managing a healthy sales pipeline", category: "Sales", is_core: false,
          levels: {
            "1": { title: "SDR", indicators: ["Maintains accurate CRM data", "Follows up on inbound leads within SLA"] },
            "2": { title: "AE", indicators: ["Builds qualified pipeline independently", "Accurately forecasts deal close dates"] },
            "3": { title: "Senior AE", indicators: ["Manages complex multi-stakeholder pipelines", "Coaches junior reps on pipeline hygiene"] },
            "4": { title: "Sales Manager", indicators: ["Designs pipeline review cadences for the team", "Identifies systemic pipeline gaps across reps"] },
            "5": { title: "VP Sales", indicators: ["Architects pipeline strategy across segments", "Drives predictable revenue through pipeline analytics"] },
          },
        },
        {
          name: "Negotiation & Closing", description: "Ability to negotiate terms and close deals", category: "Sales", is_core: false,
          levels: {
            "1": { title: "SDR", indicators: ["Handles basic objections using scripts", "Qualifies decision-makers correctly"] },
            "2": { title: "AE", indicators: ["Leads contract negotiation independently", "Manages competitive deals effectively"] },
            "3": { title: "Senior AE", indicators: ["Structures multi-year enterprise deals", "Navigates procurement and legal reviews"] },
            "4": { title: "Sales Manager", indicators: ["Coaches team on advanced negotiation tactics", "Approves deal structures and discount levels"] },
            "5": { title: "VP Sales", indicators: ["Negotiates strategic partnerships at C-level", "Designs pricing and packaging strategies"] },
          },
        },
        {
          name: "Account Management", description: "Growing and retaining existing customer relationships", category: "Sales", is_core: false,
          levels: {
            "1": { title: "SDR", indicators: ["Responds to customer queries promptly", "Documents customer interactions accurately"] },
            "2": { title: "AE", indicators: ["Identifies upsell opportunities in existing accounts", "Builds multi-threaded relationships within accounts"] },
            "3": { title: "Senior AE", indicators: ["Develops strategic account plans", "Drives net revenue retention above target"] },
            "4": { title: "Sales Manager", indicators: ["Designs account segmentation strategy", "Coaches team on strategic account development"] },
            "5": { title: "VP Sales", indicators: ["Defines company-wide account strategy and tiering", "Owns executive relationships for top accounts"] },
          },
        },
        {
          name: "Product Knowledge", description: "Understanding the product deeply enough to sell effectively", category: "Technical", is_core: false,
          levels: {
            "1": { title: "SDR", indicators: ["Delivers standard product pitch confidently", "Answers common prospect questions accurately"] },
            "2": { title: "AE", indicators: ["Tailors demos to prospect use cases", "Articulates competitive differentiators"] },
            "3": { title: "Senior AE", indicators: ["Provides technical depth in enterprise demos", "Influences product roadmap with market feedback"] },
            "4": { title: "Sales Manager", indicators: ["Ensures team stays current on product updates", "Partners with product on go-to-market planning"] },
            "5": { title: "VP Sales", indicators: ["Shapes product strategy based on market intelligence", "Represents product vision to analysts and press"] },
          },
        },
        {
          name: "Prospecting & Outreach", description: "Finding and engaging potential customers", category: "Sales", is_core: false,
          levels: {
            "1": { title: "SDR", indicators: ["Executes outbound cadences consistently", "Personalises outreach beyond templates"] },
            "2": { title: "AE", indicators: ["Sources own pipeline through networking and referrals", "Targets ideal customer profile accounts"] },
            "3": { title: "Senior AE", indicators: ["Builds inbound through thought leadership", "Develops account-based marketing strategies"] },
            "4": { title: "Sales Manager", indicators: ["Designs prospecting playbooks for the team", "Measures and optimises outreach effectiveness"] },
            "5": { title: "VP Sales", indicators: ["Defines go-to-market strategy and segmentation", "Builds strategic partnerships for lead generation"] },
          },
        },
      ],
    },
  },
  // ── Marketing ──
  {
    name: "Marketing",
    description: "Career framework for marketing professionals covering brand, content, demand generation, and analytics.",
    content: {
      competencies: [
        {
          name: "Brand & Messaging", description: "Developing and maintaining brand voice and positioning", category: "Strategic", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Follows brand guidelines consistently", "Writes clear copy for standard channels"] },
            "2": { title: "Specialist", indicators: ["Develops messaging for campaigns independently", "Maintains brand consistency across channels"] },
            "3": { title: "Senior", indicators: ["Shapes brand positioning for new markets", "Creates messaging frameworks for product launches"] },
            "4": { title: "Director", indicators: ["Defines brand strategy and voice guidelines", "Manages brand through crisis communications"] },
            "5": { title: "VP", indicators: ["Sets company-wide brand vision", "Positions brand for IPO or major market expansion"] },
          },
        },
        {
          name: "Demand Generation", description: "Driving pipeline and revenue through marketing programs", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Executes campaign tasks on schedule", "Reports on basic campaign metrics"] },
            "2": { title: "Specialist", indicators: ["Runs multi-channel campaigns independently", "Optimises campaigns based on performance data"] },
            "3": { title: "Senior", indicators: ["Designs full-funnel demand gen strategy", "Manages marketing budget and ROI targets"] },
            "4": { title: "Director", indicators: ["Builds scalable demand generation engine", "Aligns marketing pipeline targets with sales"] },
            "5": { title: "VP", indicators: ["Defines revenue marketing strategy across segments", "Builds predictable marketing-sourced pipeline model"] },
          },
        },
        {
          name: "Content Strategy", description: "Planning and producing content that drives awareness and conversion", category: "Strategic", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Produces content from briefs on time", "Follows SEO best practices in writing"] },
            "2": { title: "Specialist", indicators: ["Creates content calendars and editorial plans", "Writes thought leadership pieces independently"] },
            "3": { title: "Senior", indicators: ["Develops content strategy aligned to buyer journey", "Manages freelance writers and content operations"] },
            "4": { title: "Director", indicators: ["Builds content engine that drives measurable pipeline", "Defines content standards and governance"] },
            "5": { title: "VP", indicators: ["Creates company narrative and content vision", "Positions executives as industry thought leaders"] },
          },
        },
        {
          name: "Marketing Analytics", description: "Measuring, analysing, and optimising marketing performance", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Pulls standard reports accurately", "Tracks campaign KPIs in dashboards"] },
            "2": { title: "Specialist", indicators: ["Analyses campaign performance and recommends changes", "Sets up attribution models and tracking"] },
            "3": { title: "Senior", indicators: ["Builds marketing data infrastructure", "Delivers insights that change strategy"] },
            "4": { title: "Director", indicators: ["Defines marketing measurement framework", "Presents ROI analysis to executive team"] },
            "5": { title: "VP", indicators: ["Drives data-driven culture across marketing", "Uses predictive analytics for resource allocation"] },
          },
        },
        {
          name: "Digital & Growth", description: "Leveraging digital channels for acquisition and growth", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Manages social media posts and schedules", "Runs basic paid campaigns with guidance"] },
            "2": { title: "Specialist", indicators: ["Optimises paid acquisition across channels", "Runs A/B tests on landing pages and ads"] },
            "3": { title: "Senior", indicators: ["Designs growth experiments and scaling strategies", "Manages significant ad spend profitably"] },
            "4": { title: "Director", indicators: ["Builds growth team and experimentation culture", "Owns customer acquisition cost and LTV targets"] },
            "5": { title: "VP", indicators: ["Defines company growth strategy across all channels", "Drives product-led growth initiatives"] },
          },
        },
      ],
    },
  },
  // ── Customer Success ──
  {
    name: "Customer Success",
    description: "Career framework for customer success professionals covering onboarding, retention, and expansion.",
    content: {
      competencies: [
        {
          name: "Customer Onboarding", description: "Guiding new customers to value quickly", category: "Core", is_core: false,
          levels: {
            "1": { title: "CSA", indicators: ["Follows onboarding playbook accurately", "Tracks customer milestones in CRM"] },
            "2": { title: "CSM", indicators: ["Customises onboarding to customer needs", "Achieves time-to-value targets consistently"] },
            "3": { title: "Senior CSM", indicators: ["Designs onboarding for enterprise accounts", "Identifies and mitigates adoption risks early"] },
            "4": { title: "CS Manager", indicators: ["Builds scalable onboarding programs", "Measures and improves onboarding metrics across team"] },
            "5": { title: "VP CS", indicators: ["Defines onboarding strategy for all segments", "Builds self-serve onboarding for SMB tier"] },
          },
        },
        {
          name: "Retention & Health Scoring", description: "Monitoring and improving customer health to prevent churn", category: "Technical", is_core: false,
          levels: {
            "1": { title: "CSA", indicators: ["Monitors health scores and flags at-risk accounts", "Follows escalation procedures correctly"] },
            "2": { title: "CSM", indicators: ["Proactively intervenes on declining health scores", "Conducts QBRs with key accounts"] },
            "3": { title: "Senior CSM", indicators: ["Builds customer health models and playbooks", "Reduces churn rate within portfolio"] },
            "4": { title: "CS Manager", indicators: ["Designs health scoring methodology", "Owns net retention metrics for the team"] },
            "5": { title: "VP CS", indicators: ["Defines company-wide retention strategy", "Builds predictive churn models with data team"] },
          },
        },
        {
          name: "Expansion & Upselling", description: "Growing revenue within existing accounts", category: "Sales", is_core: false,
          levels: {
            "1": { title: "CSA", indicators: ["Identifies basic upsell signals", "Passes qualified expansion leads to AE"] },
            "2": { title: "CSM", indicators: ["Drives expansion conversations independently", "Achieves net revenue retention targets"] },
            "3": { title: "Senior CSM", indicators: ["Develops strategic account growth plans", "Closes expansion deals without AE involvement"] },
            "4": { title: "CS Manager", indicators: ["Builds expansion playbooks and enablement", "Sets and tracks NRR targets across portfolio"] },
            "5": { title: "VP CS", indicators: ["Designs CS-led revenue strategy", "Aligns expansion with product and sales strategy"] },
          },
        },
        {
          name: "Customer Advocacy", description: "Building champions and leveraging customer stories", category: "Strategic", is_core: false,
          levels: {
            "1": { title: "CSA", indicators: ["Collects customer feedback and NPS responses", "Identifies happy customers for testimonials"] },
            "2": { title: "CSM", indicators: ["Builds champion relationships within accounts", "Secures case studies and references"] },
            "3": { title: "Senior CSM", indicators: ["Develops customer advisory board programs", "Drives advocacy that generates pipeline"] },
            "4": { title: "CS Manager", indicators: ["Builds systematic advocacy program", "Measures advocacy impact on pipeline and retention"] },
            "5": { title: "VP CS", indicators: ["Creates customer community strategy", "Positions top customers as co-marketing partners"] },
          },
        },
        {
          name: "Technical Product Knowledge", description: "Deep understanding of the product to guide customer outcomes", category: "Technical", is_core: false,
          levels: {
            "1": { title: "CSA", indicators: ["Knows product features and common workflows", "Resolves basic customer questions independently"] },
            "2": { title: "CSM", indicators: ["Advises customers on best practices and configurations", "Troubleshoots intermediate product issues"] },
            "3": { title: "Senior CSM", indicators: ["Designs custom solutions for complex use cases", "Provides product feedback that shapes roadmap"] },
            "4": { title: "CS Manager", indicators: ["Ensures team maintains deep product expertise", "Partners with product on customer-driven features"] },
            "5": { title: "VP CS", indicators: ["Influences product strategy with customer insights", "Builds CS engineering or solutions team"] },
          },
        },
      ],
    },
  },
  // ── Finance & Operations ──
  {
    name: "Finance & Operations",
    description: "Career framework for finance and operations professionals covering analysis, planning, compliance, and process excellence.",
    content: {
      competencies: [
        {
          name: "Financial Analysis", description: "Analysing financial data to inform decisions", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Analyst", indicators: ["Produces accurate financial reports on time", "Performs variance analysis with guidance"] },
            "2": { title: "Senior Analyst", indicators: ["Builds financial models independently", "Identifies trends and provides actionable insights"] },
            "3": { title: "Manager", indicators: ["Leads budgeting and forecasting cycles", "Presents financial analysis to leadership"] },
            "4": { title: "Director", indicators: ["Designs financial planning framework", "Drives strategic resource allocation decisions"] },
            "5": { title: "VP/CFO", indicators: ["Sets company financial strategy", "Manages investor relations and board reporting"] },
          },
        },
        {
          name: "Process Optimisation", description: "Improving operational efficiency and scalability", category: "Core", is_core: false,
          levels: {
            "1": { title: "Analyst", indicators: ["Documents existing processes accurately", "Identifies bottlenecks in workflows"] },
            "2": { title: "Senior Analyst", indicators: ["Redesigns processes for efficiency gains", "Implements automation for repetitive tasks"] },
            "3": { title: "Manager", indicators: ["Leads cross-functional process improvement projects", "Measures and reports on operational KPIs"] },
            "4": { title: "Director", indicators: ["Builds operational excellence framework", "Drives company-wide efficiency initiatives"] },
            "5": { title: "VP/COO", indicators: ["Defines operational strategy for scale", "Builds systems that support 10x growth"] },
          },
        },
        {
          name: "Compliance & Risk", description: "Ensuring regulatory compliance and managing risk", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Analyst", indicators: ["Follows compliance checklists and procedures", "Reports compliance issues promptly"] },
            "2": { title: "Senior Analyst", indicators: ["Conducts compliance audits independently", "Maintains regulatory documentation"] },
            "3": { title: "Manager", indicators: ["Designs compliance programs for new regulations", "Manages internal audit processes"] },
            "4": { title: "Director", indicators: ["Builds enterprise risk management framework", "Leads regulatory relationships and filings"] },
            "5": { title: "VP/CFO", indicators: ["Sets compliance strategy across jurisdictions", "Manages board-level risk reporting"] },
          },
        },
        {
          name: "Vendor & Procurement", description: "Managing vendor relationships and procurement processes", category: "Core", is_core: false,
          levels: {
            "1": { title: "Analyst", indicators: ["Processes purchase orders accurately", "Maintains vendor records and contracts"] },
            "2": { title: "Senior Analyst", indicators: ["Negotiates vendor terms and pricing", "Evaluates vendor performance against SLAs"] },
            "3": { title: "Manager", indicators: ["Manages vendor portfolio and consolidation", "Leads RFP processes for major purchases"] },
            "4": { title: "Director", indicators: ["Designs procurement strategy and policies", "Manages strategic vendor partnerships"] },
            "5": { title: "VP/COO", indicators: ["Defines company-wide procurement strategy", "Negotiates enterprise-level partnerships"] },
          },
        },
      ],
    },
  },
  // ── Design & UX ──
  {
    name: "Design & UX",
    description: "Career framework for designers covering user research, visual design, interaction design, and design leadership.",
    content: {
      competencies: [
        {
          name: "User Research", description: "Understanding user needs through research methods", category: "Core", is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Conducts basic usability tests with guidance", "Documents research findings clearly"] },
            "2": { title: "Mid", indicators: ["Plans and executes research studies independently", "Synthesises findings into actionable insights"] },
            "3": { title: "Senior", indicators: ["Designs research programs that shape product strategy", "Mentors others on research methodologies"] },
            "4": { title: "Lead", indicators: ["Builds research operations and tooling", "Drives research culture across the organisation"] },
            "5": { title: "Head of Design", indicators: ["Defines user-centred design strategy", "Represents user voice at executive level"] },
          },
        },
        {
          name: "Visual Design", description: "Creating aesthetically excellent and brand-consistent designs", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Follows design system guidelines", "Produces assets for standard use cases"] },
            "2": { title: "Mid", indicators: ["Creates polished designs for complex features", "Contributes components to design system"] },
            "3": { title: "Senior", indicators: ["Defines visual direction for major initiatives", "Evolves design system and brand expression"] },
            "4": { title: "Lead", indicators: ["Sets visual design standards across products", "Manages external design agency relationships"] },
            "5": { title: "Head of Design", indicators: ["Defines company visual identity and design language", "Drives design excellence as competitive advantage"] },
          },
        },
        {
          name: "Interaction Design", description: "Designing intuitive, usable product experiences", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Creates wireframes and prototypes with guidance", "Follows established interaction patterns"] },
            "2": { title: "Mid", indicators: ["Designs end-to-end user flows independently", "Iterates designs based on user feedback"] },
            "3": { title: "Senior", indicators: ["Solves complex interaction challenges", "Establishes interaction patterns for new product areas"] },
            "4": { title: "Lead", indicators: ["Defines interaction design principles", "Ensures consistency across product surfaces"] },
            "5": { title: "Head of Design", indicators: ["Shapes product UX vision and strategy", "Drives design thinking across the organisation"] },
          },
        },
        {
          name: "Design Systems", description: "Building and maintaining scalable design systems", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Uses design system components correctly", "Reports inconsistencies and bugs"] },
            "2": { title: "Mid", indicators: ["Creates new components following system patterns", "Documents component usage guidelines"] },
            "3": { title: "Senior", indicators: ["Architects design system structure and governance", "Drives adoption across teams"] },
            "4": { title: "Lead", indicators: ["Manages design system as a product", "Aligns design system with engineering architecture"] },
            "5": { title: "Head of Design", indicators: ["Defines design system strategy across platforms", "Builds design-engineering collaboration model"] },
          },
        },
        {
          name: "Design Leadership", description: "Leading design teams and driving design culture", category: "Leadership", is_core: false,
          levels: {
            "1": { title: "Junior", indicators: ["Presents own work clearly in critiques", "Accepts and applies feedback constructively"] },
            "2": { title: "Mid", indicators: ["Gives constructive feedback in design reviews", "Mentors junior designers informally"] },
            "3": { title: "Senior", indicators: ["Leads design projects and coordinates with stakeholders", "Facilitates design sprints and workshops"] },
            "4": { title: "Lead", indicators: ["Manages and develops a team of designers", "Defines design process and quality standards"] },
            "5": { title: "Head of Design", indicators: ["Builds and scales design organisation", "Represents design at executive level and drives culture"] },
          },
        },
      ],
    },
  },
  // ── Human Resources ──
  {
    name: "Human Resources",
    description: "Career framework for HR professionals based on SHRM principles covering talent acquisition, employee relations, and organisational development.",
    content: {
      competencies: [
        {
          name: "Talent Acquisition", description: "Attracting and hiring top talent", category: "Core", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Schedules interviews and manages candidate logistics", "Maintains accurate ATS records"] },
            "2": { title: "Recruiter", indicators: ["Sources and screens candidates independently", "Manages candidate experience through full lifecycle"] },
            "3": { title: "Senior Recruiter", indicators: ["Fills complex senior and niche roles", "Builds employer brand through strategic channels"] },
            "4": { title: "TA Manager", indicators: ["Designs recruiting strategy and processes", "Manages recruiting team and agency relationships"] },
            "5": { title: "VP People", indicators: ["Defines company-wide talent strategy", "Builds employer brand at industry level"] },
          },
        },
        {
          name: "Employee Relations", description: "Managing employee relations and workplace culture", category: "Core", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Handles basic employee queries and documentation", "Follows HR policies and procedures correctly"] },
            "2": { title: "Generalist", indicators: ["Resolves employee issues independently", "Conducts investigations with guidance"] },
            "3": { title: "Senior Generalist", indicators: ["Manages complex employee relations cases", "Advises managers on performance improvement plans"] },
            "4": { title: "HR Manager", indicators: ["Designs employee relations policies and programs", "Manages sensitive terminations and restructures"] },
            "5": { title: "VP People", indicators: ["Sets employee experience strategy", "Manages crisis communications and workplace culture"] },
          },
        },
        {
          name: "Learning & Development", description: "Building employee capabilities through training and development", category: "Strategic", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Coordinates training logistics and materials", "Tracks training completion and feedback"] },
            "2": { title: "L&D Specialist", indicators: ["Designs and delivers training programs", "Evaluates training effectiveness with data"] },
            "3": { title: "Senior L&D", indicators: ["Builds leadership development programs", "Creates career frameworks and progression paths"] },
            "4": { title: "L&D Manager", indicators: ["Designs company-wide learning strategy", "Manages L&D budget and vendor relationships"] },
            "5": { title: "VP People", indicators: ["Defines talent development as competitive advantage", "Builds learning culture across the organisation"] },
          },
        },
        {
          name: "Compensation & Benefits", description: "Designing and managing total rewards programs", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Processes payroll and benefits administration accurately", "Answers basic compensation questions"] },
            "2": { title: "Analyst", indicators: ["Conducts market compensation benchmarking", "Administers equity and bonus programs"] },
            "3": { title: "Senior Analyst", indicators: ["Designs compensation bands and structures", "Manages benefits program selection and renewal"] },
            "4": { title: "Comp Manager", indicators: ["Builds total rewards philosophy and strategy", "Manages executive compensation programs"] },
            "5": { title: "VP People", indicators: ["Defines compensation strategy for talent retention", "Manages board-level compensation committee"] },
          },
        },
        {
          name: "HR Analytics & Compliance", description: "Using data for HR decisions and ensuring legal compliance", category: "Technical", is_core: false,
          levels: {
            "1": { title: "Coordinator", indicators: ["Maintains accurate employee records", "Runs standard HR reports"] },
            "2": { title: "Analyst", indicators: ["Analyses turnover, engagement, and diversity metrics", "Ensures compliance with labour laws"] },
            "3": { title: "Senior Analyst", indicators: ["Builds HR dashboards and predictive models", "Leads compliance audits and certifications"] },
            "4": { title: "HR Manager", indicators: ["Defines HR metrics framework and reporting", "Manages multi-jurisdiction compliance"] },
            "5": { title: "VP People", indicators: ["Uses people analytics for strategic decisions", "Defines company-wide DEI and compliance strategy"] },
          },
        },
      ],
    },
  },
];

// ── System Cycle Profiles ───────────────────────────────────────────────────

const SYSTEM_CYCLE_PROFILES = [
  {
    name: "Annual Performance Review",
    description: "Comprehensive yearly review cycle covering all competency categories with structured calibration.",
    content: {
      cycle_type: "annual",
      suggested_description: "Annual performance review covering all competencies and growth areas",
      suggested_competency_categories: ["Technical", "Leadership", "Core"],
      review_template_name: "Annual Performance Review",
      phase_weights: [0.15, 0.20, 0.20, 0.20, 0.15, 0.10],
    },
  },
  {
    name: "Quarterly Check-in",
    description: "Lightweight quarterly pulse focused on core competencies and engagement.",
    content: {
      cycle_type: "quarterly",
      suggested_description: "Quick quarterly check-in to assess progress and engagement",
      suggested_competency_categories: ["Core"],
      review_template_name: "Quarterly Pulse",
      phase_weights: [0.15, 0.20, 0.20, 0.20, 0.15, 0.10],
    },
  },
  {
    name: "90-Day Probation",
    description: "Structured new-hire evaluation covering core and technical competencies during the probation period.",
    content: {
      cycle_type: "probation",
      suggested_description: "90-day new hire evaluation to assess role fit and team integration",
      suggested_competency_categories: ["Core", "Technical"],
      review_template_name: "90-Day Probation Review",
      phase_weights: [0.15, 0.20, 0.20, 0.20, 0.15, 0.10],
    },
  },
  {
    name: "Manager 360 Feedback",
    description: "Multi-rater feedback cycle for managers focused on leadership effectiveness.",
    content: {
      cycle_type: "custom",
      suggested_description: "360-degree feedback for managers covering leadership competencies",
      suggested_competency_categories: ["Leadership"],
      review_template_name: "Manager Effectiveness",
      phase_weights: [0.15, 0.20, 0.20, 0.20, 0.15, 0.10],
    },
  },
];

// ── System Goal Templates ───────────────────────────────────────────────────

const SYSTEM_GOAL_TEMPLATES = [
  {
    name: "Improve a Metric",
    description: "Set a measurable improvement target with baseline and goal values",
    template_type: "goal_template",
    is_system: true,
    content: { title: "Improve [metric] by [X]%", scope: "individual", metric_start: 0, metric_target: 100, metric_unit: "%" },
  },
  {
    name: "Complete a Project",
    description: "Track a project from start to completion with a deadline",
    template_type: "goal_template",
    is_system: true,
    content: { title: "Complete [project name] by [date]", scope: "individual" },
  },
  {
    name: "Team Development",
    description: "Track team learning and development activities",
    template_type: "goal_template",
    is_system: true,
    content: { title: "Complete [X] team development sessions", scope: "team", metric_start: 0, metric_target: 4, metric_unit: "sessions" },
  },
  {
    name: "Customer Satisfaction",
    description: "Improve customer satisfaction scores",
    template_type: "goal_template",
    is_system: true,
    content: { title: "Increase CSAT score to [target]", scope: "team", metric_start: 0, metric_target: 5, metric_unit: "score" },
  },
];

// ── Seeding Function ────────────────────────────────────────────────────────

async function seedSystemTemplates(workspaceId: string) {
  const supabase = await createServerSupabaseClient();

  // Fetch existing system template names to avoid duplicates
  const { data: existing } = await supabase
    .from("templates")
    .select("name")
    .eq("workspace_id", workspaceId)
    .eq("is_system", true);

  const existingNames = new Set((existing || []).map((t: any) => t.name));

  // Seed review templates (skip already-existing by name)
  const reviewRows = SYSTEM_REVIEW_TEMPLATES
    .filter((t) => !existingNames.has(t.name))
    .map((t) => ({
      workspace_id: workspaceId,
      name: t.name,
      description: t.description,
      questions: t.questions,
      template_type: "review",
      is_system: true,
      is_default: false,
    }));

  // Seed competency framework templates
  const frameworkRows = SYSTEM_COMPETENCY_FRAMEWORKS
    .filter((t) => !existingNames.has(t.name))
    .map((t) => ({
      workspace_id: workspaceId,
      name: t.name,
      description: t.description,
      content: t.content,
      template_type: "competency_framework",
      is_system: true,
      is_default: false,
    }));

  // Seed cycle profile templates
  const cycleRows = SYSTEM_CYCLE_PROFILES
    .filter((t) => !existingNames.has(t.name))
    .map((t) => ({
      workspace_id: workspaceId,
      name: t.name,
      description: t.description,
      content: t.content,
      template_type: "cycle_profile",
      is_system: true,
      is_default: false,
    }));

  // Seed goal templates
  const goalRows = SYSTEM_GOAL_TEMPLATES
    .filter((t) => !existingNames.has(t.name))
    .map((t) => ({
      ...t,
      workspace_id: workspaceId,
      is_default: false,
    }));

  const allRows = [...reviewRows, ...frameworkRows, ...cycleRows, ...goalRows];
  if (allRows.length > 0) {
    await supabase.from("templates").insert(allRows);
  }
}

// ── Data Fetching ───────────────────────────────────────────────────────────

async function getTemplates(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("templates")
    .select("*, creator:users!templates_created_by_fkey(slack_name)")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return data || [];
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function TemplatesPage() {
  const workspace = await getUserWorkspace();

  if (!isManagerOrAbove(workspace?.role) && !workspace?.hasDirectReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
          Template management is available to managers and admins.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const workspaceId = workspace?.workspaceId;
  if (!workspaceId) {
    return <div className="p-8 text-center text-muted-foreground">Workspace not found.</div>;
  }

  // Seed system templates if they don't exist yet
  await seedSystemTemplates(workspaceId);

  const templates = await getTemplates(workspaceId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Template Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review templates, competency frameworks, cycle profiles, and goal templates
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard/templates/new">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Template
          </Link>
        </Button>
      </div>

      {/* Tabbed content */}
      <TemplatesClient templates={templates} />
    </div>
  );
}
