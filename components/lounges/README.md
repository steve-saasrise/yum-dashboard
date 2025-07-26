# Topic Management Components

This directory contains UI components for topic management features in the Daily News application.

## TopicSelector

A multi-select dropdown component with inline topic creation capabilities.

### Features

- **Multi-select dropdown**: Select multiple topics with visual badges
- **Search functionality**: Filter topics by name or description
- **Inline creation**: Create new topics directly from the selector
- **System topic badges**: Visual distinction for system topics
- **Loading states**: Smooth loading experience
- **Error handling**: User-friendly error messages
- **Keyboard navigation**: Full keyboard support via Command component
- **Accessibility**: ARIA labels and proper roles

### Basic Usage

```tsx
import { TopicSelector } from '@/components/topics';

function MyForm() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  return (
    <TopicSelector
      selectedTopics={selectedTopics}
      onChange={setSelectedTopics}
      placeholder="Select topics..."
    />
  );
}
```

### Props

| Prop           | Type                               | Default              | Description                                   |
| -------------- | ---------------------------------- | -------------------- | --------------------------------------------- |
| selectedTopics | `string[]`                         | `[]`                 | Array of selected topic IDs                   |
| onChange       | `(topics: string[]) => void`       | -                    | Callback when selection changes               |
| placeholder    | `string`                           | `"Select topics..."` | Placeholder text when no topics selected      |
| maxSelections  | `number`                           | -                    | Maximum number of topics that can be selected |
| allowCreate    | `boolean`                          | `true`               | Whether to allow inline topic creation        |
| onCreateTopic  | `(name: string) => Promise<Topic>` | -                    | Custom topic creation handler                 |
| disabled       | `boolean`                          | `false`              | Whether the selector is disabled              |
| className      | `string`                           | -                    | Additional CSS classes                        |

### Advanced Examples

#### With Maximum Selections

```tsx
<TopicSelector
  selectedTopics={selectedTopics}
  onChange={setSelectedTopics}
  maxSelections={3}
  placeholder="Select up to 3 topics"
/>
```

#### With Custom Creation Handler

```tsx
const handleCreateTopic = async (name: string) => {
  // Custom creation logic
  const response = await fetch('/api/topics', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: 'Auto-generated topic',
      parent_topic_id: parentId,
    }),
  });
  return response.json();
};

<TopicSelector
  selectedTopics={selectedTopics}
  onChange={setSelectedTopics}
  onCreateTopic={handleCreateTopic}
/>;
```

#### In a Form with React Hook Form

```tsx
import { useForm, Controller } from 'react-hook-form';
import { TopicSelector } from '@/components/topics';

function CreatorForm() {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      topics: [],
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="topics"
        control={control}
        render={({ field }) => (
          <TopicSelector
            selectedTopics={field.value}
            onChange={field.onChange}
            placeholder="Select creator topics"
          />
        )}
      />
    </form>
  );
}
```

### API Integration

The component automatically integrates with the Topic Management API:

- **GET /api/topics**: Fetches available topics
- **POST /api/topics**: Creates new topics (when using default creation)

Authentication is handled via the stored Supabase auth token.

### Styling

The component uses Tailwind CSS and follows the application's design system:

- Uses Shadcn/UI components (Command, Popover, Badge, Button)
- Responsive design with mobile support
- Dark mode compatible
- Consistent with application theme

### Error Handling

The component handles various error scenarios:

- Failed API requests show toast notifications
- Duplicate topic names are detected
- Maximum topic name length (50 chars) is enforced
- Network errors are handled gracefully

### Accessibility

- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly
- Focus management

### Testing

The component includes comprehensive tests covering:

- Basic rendering and interactions
- API integration
- Error scenarios
- Edge cases
- Accessibility

Run tests with:

```bash
npm test components/topics/__tests__/topic-selector.test.tsx
```

## useTopics Hook

A custom React hook for managing topics data and operations.

### Usage

```tsx
import { useTopics } from '@/hooks/use-topics';

function MyComponent() {
  const { topics, loading, error, createTopic, updateTopic, deleteTopic } =
    useTopics({
      search: 'tech',
      sort: 'name',
      order: 'asc',
    });

  // Use topics data and methods
}
```

### Returns

- `topics`: Array of Topic objects
- `loading`: Loading state
- `error`: Error message if any
- `createTopic`: Function to create a new topic
- `updateTopic`: Function to update an existing topic
- `deleteTopic`: Function to delete a topic
- `refreshTopics`: Function to manually refresh topics

## Future Enhancements

- Hierarchical topic display (tree view)
- Bulk topic operations
- Topic merge functionality
- Usage analytics display
- Keyboard shortcuts for power users
