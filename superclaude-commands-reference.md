# SuperClaude Commands & Personas Reference Guide

_Complete reference for all available SuperClaude commands, personas, and flags for optimal task selection_

## Available Commands (19 Total)

### Development Commands (3)

- **/build** - Universal project builder with stack templates
  - Flags: `--init`, `--feature`, `--tdd`, `--react`, `--api`, `--fullstack`, `--mobile`, `--cli`
  - Best for: Creating projects, implementing features, building components
- **/dev-setup** - Development environment configuration
  - Flags: `--install`, `--ci`, `--monitor`, `--docker`, `--testing`, `--team`, `--standards`
  - Best for: Environment setup, CI/CD pipeline configuration

- **/test** - Testing framework with comprehensive coverage
  - Flags: `--e2e`, `--integration`, `--unit`, `--visual`, `--mutation`, `--performance`, `--accessibility`, `--parallel`, `--coverage`
  - Best for: Quality assurance, test automation

### Analysis & Improvement Commands (5)

- **/review** - AI-powered code review with evidence-based recommendations
  - Flags: `--files`, `--commit`, `--pr`, `--quality`, `--evidence`, `--fix`, `--summary`
  - Best for: Code quality assessment, security reviews

- **/analyze** - Multi-dimensional code and system analysis
  - Flags: `--code`, `--architecture`, `--profile`, `--deps`, `--surface`, `--deep`, `--forensic`
  - Best for: System assessment, performance analysis, dependency analysis

- **/troubleshoot** - Professional debugging and issue resolution
  - Flags: `--investigate`, `--five-whys`, `--prod`, `--perf`, `--fix`, `--hotfix`, `--rollback`
  - Best for: Production debugging, root cause analysis

- **/improve** - Enhancement and optimization with measurable outcomes
  - Flags: `--quality`, `--performance`, `--accessibility`, `--iterate`, `--threshold`, `--refactor`, `--modernize`
  - Best for: Performance optimization, code quality improvements

- **/explain** - Technical documentation and knowledge transfer
  - Flags: `--depth`, `--visual`, `--examples`, `--api`, `--architecture`, `--tutorial`, `--reference`
  - Best for: Documentation generation, knowledge transfer

### Operations Commands (6)

- **/deploy** - Application deployment with rollback capabilities
  - Flags: `--env`, `--canary`, `--blue-green`, `--rolling`, `--checkpoint`, `--rollback`, `--monitor`
  - Best for: Production deployments, environment management

- **/migrate** - Database and code migrations with safety features
  - Flags: `--database`, `--code`, `--config`, `--dependencies`, `--backup`, `--rollback`, `--validate`
  - Best for: Database changes, code migrations

- **/scan** - Security auditing and compliance validation
  - Flags: `--security`, `--owasp`, `--deps`, `--compliance`, `--gdpr`, `--quality`, `--automated`
  - Best for: Security audits, compliance checks

- **/estimate** - Project estimation with risk assessment
  - Flags: `--detailed`, `--rough`, `--worst-case`, `--agile`, `--complexity`, `--resources`, `--timeline`, `--risk`
  - Best for: Project planning, resource estimation

- **/cleanup** - Project maintenance with safety validations
  - Flags: `--code`, `--files`, `--deps`, `--git`, `--all`, `--aggressive`, `--conservative`
  - Best for: Technical debt reduction, project maintenance

- **/git** - Git workflow management with safety features
  - Flags: `--status`, `--commit`, `--branch`, `--sync`, `--checkpoint`, `--merge`, `--history`, `--pre-commit`
  - Best for: Version control operations, commit management

### Design & Workflow Commands (5)

- **/design** - System architecture and design specifications
  - Flags: `--api`, `--ddd`, `--microservices`, `--event-driven`, `--openapi`, `--graphql`, `--bounded-context`, `--integration`
  - Best for: System design, API architecture

- **/spawn** - Specialized agents for parallel task execution
  - Flags: `--task`, `--parallel`, `--specialized`, `--collaborative`, `--sync`, `--merge`
  - Best for: Complex multi-agent workflows

- **/document** - Professional documentation in multiple formats
  - Flags: `--user`, `--technical`, `--markdown`, `--interactive`, `--multilingual`, `--maintain`
  - Best for: Documentation creation, user guides

- **/load** - Project context loading and analysis
  - Flags: `--depth`, `--context`, `--patterns`, `--relationships`, `--structure`, `--health`, `--standards`
  - Best for: Project assessment, codebase understanding

- **/task** - Advanced task management system
  - Subcommands: `create`, `status`, `resume`, `update`, `complete`
  - Best for: Complex project tracking, workflow management

## Cognitive Personas (9 Available)

### Technical Personas

- **--persona-architect** - Systems thinking, scalability, patterns
  - Best for: Architecture decisions, system design, technical planning
- **--persona-frontend** - UI/UX obsessed, accessibility-first
  - Best for: User interfaces, component design, UX optimization

- **--persona-backend** - APIs, databases, reliability
  - Best for: Server architecture, data modeling, API design

### Analysis Personas

- **--persona-analyzer** - Root cause analysis, evidence-based
  - Best for: Complex debugging, investigations, forensic analysis

- **--persona-security** - Threat modeling, zero-trust, OWASP
  - Best for: Security audits, vulnerability assessment, compliance

- **--persona-performance** - Optimization, profiling, efficiency
  - Best for: Performance tuning, bottleneck identification, optimization

### Quality & Process Personas

- **--persona-mentor** - Teaching, guided learning, clarity
  - Best for: Documentation, knowledge transfer, training

- **--persona-refactorer** - Code quality, maintainability
  - Best for: Code cleanup, technical debt reduction, refactoring

- **--persona-qa** - Testing, edge cases, validation
  - Best for: Quality assurance, test coverage, validation testing

## Universal Flags

### Thinking Depth Control

- **--think** - Multi-file analysis (~4K tokens)
- **--think-hard** - Architecture-level depth (~10K tokens)
- **--ultrathink** - Critical system analysis (~32K tokens)

### Planning & Execution

- **--plan** - Show detailed execution plan before running
- **--dry-run** - Preview changes without execution
- **--watch** - Continuous monitoring with real-time feedback
- **--interactive** - Step-by-step guided process
- **--force** - Override safety checks (use with caution)

### MCP Server Control

- **--c7** - Enable Context7 documentation lookup
- **--seq** - Enable Sequential thinking analysis
- **--magic** - Enable Magic UI component generation
- **--pup** - Enable Puppeteer browser automation
- **--all-mcp** - Enable all MCP servers for maximum capability
- **--no-mcp** - Disable all MCP servers (native tools only)

### Quality & Validation

- **--validate** - Enhanced pre-execution safety checks
- **--security** - Security-focused analysis and validation
- **--coverage** - Generate comprehensive coverage analysis
- **--strict** - Zero-tolerance mode with enhanced validation

### Token Optimization

- **--uc / --ultracompressed** - Activate UltraCompressed mode (huge token reduction)

### Advanced Features

- **--introspect** - Enable self-aware analysis with cognitive transparency

## Command Selection Guide for Your Tasks

### For Display Case Implementation (Your Current Priority):

**Recommended Command**: `/build --feature "display case pricing integration" --tdd --persona-backend`

**Why**:

- `/build` handles feature implementation with existing patterns
- `--feature` focuses on specific functionality addition
- `--tdd` ensures robust testing during development
- `--persona-backend` provides API and pricing logic expertise

**Alternative Options**:

- `/design --api --persona-architect` (if architectural planning needed first)
- `/troubleshoot --investigate --persona-analyzer` (if debugging existing integration)

### For Testing & Validation:

**Recommended Command**: `/test --coverage --e2e --persona-qa`

### For Production Deployment:

**Recommended Command**: `/deploy --env prod --plan --validate --persona-security`

### For General Development Tasks:

- **New features**: `/build --feature "description" --tdd`
- **Bug fixes**: `/troubleshoot --investigate --fix`
- **Code quality**: `/review --quality --evidence --persona-qa`
- **Performance issues**: `/analyze --profile --persona-performance`
- **Security audit**: `/scan --security --owasp --persona-security`
- **Documentation**: `/explain --depth expert --visual`

## Example Usage Patterns

```bash
# Complete feature development workflow
/design --api --ddd --persona-architect
/build --feature "auth system" --tdd --persona-backend
/test --coverage --e2e --persona-qa
/review --quality --evidence --strict
/deploy --env staging --plan --validate

# Security-first development
/scan --security --owasp --deps --persona-security
/analyze --security --forensic --seq
/improve --security --validate --strict
/test --security --coverage

# Performance optimization workflow
/analyze --profile --deep --persona-performance
/troubleshoot --perf --investigate --pup
/improve --performance --iterate --threshold 90%
/test --performance --load
```

## Best Practices

1. **Always use `--plan` for production operations**
2. **Combine `--validate` with deployment commands**
3. **Use appropriate personas for specialized expertise**
4. **Leverage `--seq` for complex analytical tasks**
5. **Apply `--uc` for token optimization when needed**
6. **Use `--dry-run` before destructive operations**

---

_For your immediate need: Use `/build --feature "display case pricing integration" --tdd --persona-backend` to implement the missing display case functionality._
