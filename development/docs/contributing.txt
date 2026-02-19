# Contributing to NetNeural IoT Platform - Supabase Development

Thank you for your interest in contributing to the NetNeural IoT Platform! This document provides guidelines and procedures for contributing to our **Supabase-first architecture** project.

## 📋 Getting Started

### Prerequisites
1. Read the [`../README.md`](../README.md) for Supabase development setup
2. Review [`TECHNICAL_SPECIFICATION.md`](./TECHNICAL_SPECIFICATION.md) for Supabase-first system architecture
3. Follow [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) for code standards
4. Understand the project structure in [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md)

### Supabase Development Environment Setup
```bash
# Clone and setup the development environment
cd development

# Install dependencies
npm install

# Install Supabase CLI (essential for development)
npm install -g supabase

# Start Supabase local development
supabase start

# Start application
npm run dev
```

## 🔄 Contribution Workflow

### 1. Issue Creation
Before starting work, create or find an existing issue that describes the work to be done.

**Issue Types:**
- **Feature**: New functionality or enhancement
- **Bug**: Problem with existing functionality  
- **Documentation**: Improvements to documentation
- **Chore**: Maintenance tasks (dependencies, refactoring)

### 2. Branch Creation
Create a branch following the naming convention:

```bash
# Feature branches
git checkout -b feature/DEV-123-add-device-sync

# Bug fix branches
git checkout -b bugfix/DEV-456-fix-auth-token

# Documentation branches
git checkout -b docs/DEV-789-update-api-docs

# Chore branches
git checkout -b chore/DEV-101-update-dependencies
```

### 3. Development Process

#### Code Standards
- Follow [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) strictly
- Write tests for all new functionality (including Edge Functions)
- Maintain >80% code coverage
- Update documentation for changes
- Use Supabase best practices for database design and Edge Functions

#### Commit Messages
Use the conventional commit format:

```bash
type(scope): description

# Examples:
feat(devices): add Golioth sync integration
fix(auth): resolve token refresh race condition
docs(api): update device endpoint documentation
test(components): add DeviceCard unit tests
```

### 4. Pull Request Process

#### PR Requirements
- [ ] All tests passing
- [ ] Code coverage maintained (>80%)
- [ ] Documentation updated
- [ ] No linting errors
- [ ] Security scan passing
- [ ] Functional review completed

#### PR Template
Use the following template for all pull requests:

```markdown
## 📋 Summary
Brief description of changes

## 🔗 Related Issues
- Closes #123
- Related to #456

## 🧪 Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## 📊 Performance Impact
- No performance impact / Performance improved / Performance impact analyzed

## 🔒 Security Considerations
- No security impact / Security review completed / Security measures added

## 📝 Documentation
- [ ] Code comments added
- [ ] API documentation updated
- [ ] README updated
- [ ] Technical documentation updated

## ✅ Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No breaking changes (or breaking changes documented)
```

## 🧪 Testing Guidelines

### Test Requirements
- **Unit Tests**: >80% coverage for all new code
- **Integration Tests**: Cover API endpoints and service interactions
- **E2E Tests**: Cover critical user workflows
- **Performance Tests**: For performance-critical features

### Running Tests
```bash
# Unit tests
npm run test

# Integration tests (with Supabase local)
npm run test:integration

# E2E tests (with full Supabase stack)
npm run test:e2e

# Edge Function tests
supabase functions serve --env-file .env.test
npm run test:functions

# All tests with coverage
npm run test:coverage
```

### Test Structure
```typescript
// Unit test example
describe('DeviceService', () => {
  describe('createDevice', () => {
    it('should create device successfully', async () => {
      // Arrange
      const deviceData = { name: 'Test Device', deviceId: 'test-001' };
      
      // Act
      const result = await deviceService.create(deviceData);
      
      // Assert
      expect(result).toMatchObject(deviceData);
      expect(result.id).toBeDefined();
    });
  });
});
```

## 📚 Documentation Guidelines

### Documentation Types
1. **Code Documentation**: JSDoc comments for functions and classes
2. **API Documentation**: OpenAPI/Swagger specifications
3. **Technical Documentation**: Architecture and design docs in `docs/`
4. **User Documentation**: Setup and usage guides

### Documentation Standards
- Write in clear, concise language
- Include practical examples
- Keep documentation up-to-date with code changes
- Use proper Markdown formatting
- Store technical docs in `development/docs/`

## 🔒 Security Guidelines

### Security Requirements
- Never commit secrets or credentials
- Follow OWASP security practices
- Use environment variables for configuration
- Validate all inputs
- Implement proper authentication and authorization

### Security Review
All PRs with security implications require security review:
- Authentication/authorization changes
- Input validation modifications
- External service integrations
- Cryptographic implementations

## 🚀 Release Process

### Version Management
- Follow semantic versioning (SemVer)
- Create release notes for each version
- Tag releases in Git
- Deploy through CI/CD pipeline

### Release Checklist
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Performance validated
- [ ] Security reviewed
- [ ] Deployment tested in staging
- [ ] Release notes created

## 🤝 Code Review Guidelines

### As a Reviewer
1. **Functionality**: Does the code work as intended?
2. **Readability**: Is the code easy to understand?
3. **Performance**: Are there performance implications?
4. **Security**: Are there security concerns?
5. **Testing**: Is there adequate test coverage?
6. **Documentation**: Is the code properly documented?

### Review Process
1. Automated checks must pass before human review
2. At least one approved review required for merge
3. Address all review comments before merging
4. Use GitHub's suggestion feature for minor fixes

## 🏃‍♂️ Getting Help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Request Comments**: Code-specific discussions

### Resources
- [`../README.md`](../README.md) - Development setup
- [`TECHNICAL_SPECIFICATION.md`](./TECHNICAL_SPECIFICATION.md) - System architecture
- [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) - Code standards
- [`troubleshooting.md`](./troubleshooting.md) - Common issues

### Mentorship
New contributors are welcome! Don't hesitate to:
- Ask questions in issues or discussions
- Request help with setup or development
- Seek guidance on best practices

## 📜 Code of Conduct

### Our Standards
- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the project
- Show empathy for other contributors

### Unacceptable Behavior
- Harassment or discrimination
- Trolling or inflammatory comments
- Personal attacks
- Publishing private information

## 🎯 Contribution Areas

### High Priority
- Core device management features
- Golioth integration improvements
- Performance optimizations
- Security enhancements
- Test coverage improvements

### Medium Priority
- UI/UX improvements
- Additional IoT platform integrations
- Analytics and reporting features
- Mobile application development

### Documentation Needs
- API endpoint documentation
- Architecture diagrams
- Deployment guides
- Troubleshooting guides

---

Thank you for contributing to the NetNeural IoT Platform! Your contributions help build a better IoT platform for everyone.