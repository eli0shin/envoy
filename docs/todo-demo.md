# Todo Tools Demo

## New Simplified API

### 1. Write todos (creates or replaces)

```typescript
await todo_write({ 
  todos: `- [ ] Review and update the language learning curriculum
- [ ] Implement vocabulary flashcard feature  
- [ ] Write unit tests for the grammar checker module`
});
```

Output:
```
- [ ] Review and update the language learning curriculum
- [ ] Implement vocabulary flashcard feature
- [ ] Write unit tests for the grammar checker module
```

### 2. Update status by rewriting the list

```typescript
await todo_write({
  todos: `- [~] Review and update the language learning curriculum
- [ ] Implement vocabulary flashcard feature
- [ ] Write unit tests for the grammar checker module`
});
```

Output:
```
- [~] Review and update the language learning curriculum
- [ ] Implement vocabulary flashcard feature
- [ ] Write unit tests for the grammar checker module
```

### 3. Mark as complete

```typescript
await todo_write({
  todos: `- [x] Review and update the language learning curriculum
- [ ] Implement vocabulary flashcard feature
- [ ] Write unit tests for the grammar checker module`
});
```

Output:
```
- [x] Review and update the language learning curriculum
- [ ] Implement vocabulary flashcard feature
- [ ] Write unit tests for the grammar checker module
```

### 4. List current todos

```typescript
await todo_list({});
```

Output:
```
- [x] Review and update the language learning curriculum
- [ ] Implement vocabulary flashcard feature
- [ ] Write unit tests for the grammar checker module
```

## Benefits Over Old API

### Old Way (3 tools)
```typescript
// Add items one by one
await todo_add({ content: 'Task 1' });
await todo_add({ content: 'Task 2' });
await todo_add({ content: 'Task 3' });

// List to get IDs
const list = await todo_list({});

// Update by ID (need to parse and find ID)
await todo_update({ 
  id: 'some-uuid-here', 
  status: 'in_progress' 
});
```

### New Way (2 tools)
```typescript
// Write entire list at once
await todo_write({ 
  todos: `- [ ] Task 1
- [~] Task 2
- [x] Task 3`
});

// That's it!
```
