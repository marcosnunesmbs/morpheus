import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/dashboard/Table';
import { Button } from '../components/dashboard/Button';
import { Checkbox } from '../components/dashboard/Checkbox';
import { Badge } from '../components/dashboard/Badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/dashboard/Card';
import { Alert, AlertDescription } from '../components/dashboard/Alert';
import { MemoryDetailModal } from '../components/dashboard/MemoryDetailModal';
import { DeleteConfirmationModal } from '../components/dashboard/DeleteConfirmationModal';
import { Trash2, Search, Calendar, Eye } from 'lucide-react';
import { useApi } from '../hooks/useApi';

interface Memory {
  id: string;
  category: string;
  importance: string;
  summary: string;
  details: string | null;
  hash: string;
  source: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  access_count: number;
  version: number;
  archived: boolean;
}

export const SatiMemories: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemories, setSelectedMemories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterImportance, setFilterImportance] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<string | null>(null);
  const [showSingleDeleteConfirmation, setShowSingleDeleteConfirmation] =
    useState(false);

  const { get, del, post } = useApi();

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const data = await get('/sati/memories');
      setMemories(data);
      setError(null);
    } catch (err) {
      setError('Failed to load memories. Please try again.');
      console.error('Error fetching memories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedMemories.length === filteredMemories.length) {
      setSelectedMemories([]);
    } else {
      setSelectedMemories(filteredMemories.map((mem) => mem.id));
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedMemories.includes(id)) {
      setSelectedMemories(selectedMemories.filter((memId) => memId !== id));
    } else {
      setSelectedMemories([...selectedMemories, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMemories.length === 0) return;

    try {
      await post('/sati/memories/bulk-delete', { ids: selectedMemories });
      await fetchMemories(); // Refresh the list
      setSelectedMemories([]); // Clear selections
      setShowDeleteConfirmation(false);
    } catch (err) {
      setError('Failed to delete memories. Please try again.');
      console.error('Error deleting memories:', err);
    }
  };

  const handleDeleteSingle = (id: string) => {
    setMemoryToDelete(id);
    setShowSingleDeleteConfirmation(true);
  };

  const confirmDeleteSingle = async () => {
    if (!memoryToDelete) return;

    try {
      await del(`/sati/memories/${memoryToDelete}`);
      await fetchMemories(); // Refresh the list
    } catch (err) {
      setError('Failed to delete memory. Please try again.');
      console.error('Error deleting memory:', err);
    } finally {
      setMemoryToDelete(null);
      setShowSingleDeleteConfirmation(false);
    }
  };

  const handleViewDetails = (memory: Memory) => {
    setSelectedMemory(memory);
    setShowDetailModal(true);
  };

  // Filter memories based on search term and filters
  const filteredMemories = memories.filter((memory) => {
    const matchesSearch =
      memory.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memory.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memory.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      filterCategory === 'all' || memory.category === filterCategory;
    const matchesImportance =
      filterImportance === 'all' || memory.importance === filterImportance;

    return (
      matchesSearch && matchesCategory && matchesImportance && !memory.archived
    );
  });

  // Get unique categories and importance levels for filters
  const categories = Array.from(new Set(memories.map((mem) => mem.category)));
  const importanceLevels = Array.from(
    new Set(memories.map((mem) => mem.importance))
  );

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-azure-primary dark:border-matrix-highlight"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight">
            Sati Memories
          </h1>
          <p className="text-azure-text-muted dark:text-matrix-secondary mt-1">
            View and manage your long-term memories stored by Sati
          </p>
        </div>

        {selectedMemories.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-azure-text-muted dark:text-matrix-secondary">
              {selectedMemories.length} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirmation(true)}
              disabled={selectedMemories.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Selected
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="border-b border-azure-border dark:border-matrix-primary">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex flex-col relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-azure-text-secondary dark:text-matrix-tertiary w-4 h-4" />
              <input
                type="text"
                placeholder="Search memories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary rounded-md text-azure-text-primary dark:text-matrix-secondary focus:outline-none focus:ring-2 focus:ring-azure-primary dark:focus:ring-matrix-highlight"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary rounded-md text-azure-text-primary dark:text-matrix-secondary focus:outline-none focus:ring-2 focus:ring-azure-primary dark:focus:ring-matrix-highlight flex-grow"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={filterImportance}
                onChange={(e) => setFilterImportance(e.target.value)}
                className="px-3 py-2 bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary rounded-md text-azure-text-primary dark:text-matrix-secondary focus:outline-none focus:ring-2 focus:ring-azure-primary dark:focus:ring-matrix-highlight flex-grow"
              >
                <option value="all">All Importance</option>
                {importanceLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      filteredMemories.length > 0 &&
                      selectedMemories.length === filteredMemories.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Importance</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMemories.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-azure-text-secondary dark:text-matrix-tertiary"
                  >
                    {loading ? 'Loading memories...' : 'No memories found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMemories.map((memory) => (
                  <TableRow key={memory.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedMemories.includes(memory.id)}
                        onCheckedChange={() => handleSelectOne(memory.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">
                      {memory.summary}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{memory.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          memory.importance === 'critical'
                            ? 'destructive'
                            : memory.importance === 'high'
                              ? 'default'
                              : memory.importance === 'medium'
                                ? 'secondary'
                                : 'outline'
                        }
                      >
                        {memory.importance}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-azure-text-secondary dark:text-matrix-tertiary">
                        <Calendar className="w-4 h-4" />
                        {new Date(memory.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(memory)}
                          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSingle(memory.id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Delete Memories</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Are you sure you want to delete {selectedMemories.length}{' '}
                memory(ies)? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirmation(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteSelected}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <MemoryDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        memory={selectedMemory}
      />

      <DeleteConfirmationModal
        isOpen={showSingleDeleteConfirmation}
        onClose={() => setShowSingleDeleteConfirmation(false)}
        onConfirm={confirmDeleteSingle}
        title="Confirm Memory Deletion"
        message="Are you sure you want to delete this memory? This action cannot be undone."
        confirmButtonText="Delete Memory"
        cancelButtonText="Cancel"
      />
    </div>
  );
};
