import { Badge } from '@/components/ui/badge';

interface UserTag {
  name: string;
  color: string;
}

interface UserTagsProps {
  tags: UserTag[];
  size?: 'sm' | 'md';
}

export function UserTags({ tags, size = 'sm' }: UserTagsProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag) => (
        <Badge
          key={tag.name}
          variant="secondary"
          className={`${size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'}`}
          style={{ 
            backgroundColor: `${tag.color}20`, 
            color: tag.color,
            borderColor: `${tag.color}40`
          }}
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}
