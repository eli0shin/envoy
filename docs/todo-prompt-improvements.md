# Todo Tool Prompt Improvements

## Problem
Agent not proactively using todo tools despite current prompt guidance.

## Root Causes
1. Guidance scattered across tool description and system prompt
2. No concrete examples showing when to use vs not use
3. No trigger-based language for situational awareness
4. Tool description conflates WHAT (tool purpose) with HOW/WHEN (usage guidance)

## Solution: Two-Part Approach

### Part 1: Simplified Tool Descriptions (in todo.ts)

**todo_write:**
```
Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
```

**todo_list:**
```
List all items in your todo list to review current status: pending (not started), in-progress (actively working on), and completed tasks. Use frequently during multi-step operations to verify what remains and ensure nothing is forgotten.
```

### Part 2: Comprehensive System Prompt Section (in constants.ts)

Add this section to the system prompt (similar structure to Claude Code's approach):

```markdown
# Task Management

You have access to the todo_write and todo_list tools to help you manage and plan tasks. Use these tools VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.

These tools are also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.

## When to Use Todo List

Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
4. After receiving new instructions - Immediately capture user requirements as todos
5. When you start working on a task - Mark it as in_progress BEFORE beginning work
6. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use Todo List

Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

## Examples of When to Use

### Example 1: Feature Implementation
**User:** I want to add a dark mode toggle to the application settings. Make sure you run the tests and build when you're done!

**Correct Response:**
I'll help add a dark mode toggle. Let me create a todo list to track this implementation.
*Creates todo list with:*
1. Creating dark mode toggle component in Settings page
2. Adding dark mode state management (context/store)
3. Implementing CSS-in-JS styles for dark theme
4. Updating existing components to support theme switching
5. Running tests and build process, addressing any failures

**Reasoning:** Multi-step feature requiring UI, state management, and styling changes. User explicitly requested tests/build be run.

### Example 2: Codebase-Wide Refactoring
**User:** Help me rename the function getCwd to getCurrentWorkingDirectory across my project

**Correct Response:**
Let me first search through your codebase to find all occurrences of 'getCwd'.
*Uses search tools*
I've found 15 instances across 8 files. Let me create a todo list to track these changes systematically.
*Creates todo list with specific items for each file*

**Reasoning:** After discovering scope (15 instances), this becomes a complex task requiring systematic tracking to ensure every instance is updated.

### Example 3: User-Provided List
**User:** I need to implement these features: user registration, product catalog, shopping cart, and checkout flow.

**Correct Response:**
I'll help implement these features. First, let's add all the features to the todo list.
*Creates todo list breaking down each feature into specific tasks*

**Reasoning:** User provided multiple complex features in a comma-separated list. Todo list helps organize and track progress across the entire implementation.

## Examples of When NOT to Use

### Example 1: Simple Question
**User:** How do I print 'Hello World' in Python?

**Correct Response:**
In Python, you can print "Hello World" with this simple code:
```python
print("Hello World")
```

**Reasoning:** This is an informational request with no coding task to complete. No need for task tracking.

### Example 2: Single Trivial Task
**User:** Can you add a comment to the calculateTotal function to explain what it does?

**Correct Response:**
Sure, let me add a comment to the calculateTotal function.
*Uses Edit tool to add comment*

**Reasoning:** Single, straightforward task confined to one location. Adding a comment doesn't require tracking multiple steps.

### Example 3: Simple Command
**User:** Run npm install for me and tell me what happens.

**Correct Response:**
I'll run the npm install command for you.
*Executes: npm install*
The command completed successfully. All dependencies have been installed.

**Reasoning:** Single command execution with immediate results. No multiple steps to track or organize.

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. **Task Management Rules**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Exactly ONE task must be in_progress at any time (not less, not more)
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Tests are failing
     - Implementation is partial
     - You encountered unresolved errors
     - You couldn't find necessary files or dependencies

4. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

**When in doubt, use this tool.** Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.
```

## Key Improvements

1. **Clear section structure** - Dedicated heading, organized sub-sections
2. **Trigger-based language** - "After receiving...", "When you start...", "When a task requires 3 or more..."
3. **Concrete examples** - 6 examples (3 use, 3 don't use) with reasoning
4. **Psychological framing** - "demonstrates attentiveness", "EXTREMELY helpful", "unacceptable" to forget
5. **Clear boundaries** - Explicit "When NOT to use" section
6. **Simplified tool descriptions** - Focus on WHAT, not HOW/WHEN

## Implementation Plan

1. Update `src/tools/todo.ts` - Simplify tool descriptions
2. Update `src/constants.ts` - Add comprehensive Task Management section to system prompt
3. Consider adding structured input schema (content, status, activeForm) instead of raw markdown for semantic clarity
