'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

interface Project {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  is_template: boolean;
  created_at: string;
}

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        setProjects(data);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map(project => (
        <Card key={project.id}>
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>
              {project.is_template ? 'Template • ' : ''}
              {project.is_public ? 'Public • ' : 'Private • '}
              Created: {new Date(project.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="line-clamp-2">{project.description}</p>
            <div className="mt-4 space-x-2">
              <Button variant="default">Open Project</Button>
              <Button variant="outline">Share</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}