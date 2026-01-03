
import { useState, useEffect } from 'react';
import './App.css';
import logoImg from './assets/flowboard-logo.png';
import logoImg1 from './assets/delete-icon.png';
import logoImg2 from './assets/edit-icon.png';
import db from './db';

function App() {
  const [tasks, setTasks] = useState({
  todo: [],
  inProgress: [],
  done: [],
});

  useEffect(() => {
    async function loadTasks() {
    try {
        const allTasks = await db.tasks.toArray();
        const grouped = { todo: [], inProgress: [], done: [] };
        allTasks.forEach(task => {
          if (!task.deleted) {
            grouped[task.status || 'todo'].push(task);
          }
        });

        setTasks(grouped);
      } catch (err) {
        console.error("Failed to load tasks:", err);
      }
    }

    loadTasks();
  }, []);

  useEffect(() => {
  async function testDB() {
    await db.tasks.add({
      title: 'Test Task',
      description: 'Check if it works',
      status: 'todo',
      priority: 'HIGH',
      deleted: false,
      synced: false
    });

    const allTasks = await db.tasks.toArray();
    console.log('All tasks in DB:', allTasks);
  }

  testDB();
}, []);


  useEffect(() => {
    async function syncTasksToServer() {
      const unsynced = await db.tasks.where('synced').equals(false).toArray();

      for (const task of unsynced) {
        try {
          await fetch('/api/tasks', {
            method: task.deleted ? 'DELETE' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
          });

          await db.tasks.update(task.id, { synced: true });
        } catch (err) {
          console.log('Sync failed, will retry later', err);
        }
      }
    }
    syncTasksToServer();

    window.addEventListener('online', syncTasksToServer);
    return () => window.removeEventListener('online', syncTasksToServer);
  }, []);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Cleanup
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);



  const [modal, setModal] = useState({
    isOpen: false,
    mode: 'add',      
    column: 'todo',
    taskId: null,
    title: '',
    description: '',
    priority: 'HIGH',
  });

  const handleDelete = async (column, taskId) => {
  await db.tasks.update(taskId, { deleted: true, synced: false });

  setTasks(prev => ({
    ...prev,
    [column]: prev[column].filter(task => task.id !== taskId),
  }));
};



  const openAddModal = (column) => {
    setModal({
      isOpen: true,
      mode: 'add',
      column,
      taskId: null,
      title: '',
      description: '',
      priority: 'HIGH',
    });
  };

  const total = tasks.todo.length + tasks.inProgress.length + tasks.done.length;
  const inProgress = tasks.inProgress.length;
  const completed = tasks.done.length;

  const openEditModal = (column, task) => {
    setModal({
      isOpen: true,
      mode: 'edit',
      column,
      taskId: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
    });
  };

  const closeModal = () => {
    setModal((m) => ({ ...m, isOpen: false }));
  };

  const [dragInfo, setDragInfo] = useState(null); // { column, taskId } or null

 



  const handleModalSubmit = async () => {
  
  const trimmedTitle = modal.title.trim();
  const trimmedDesc = modal.description.trim();

  
  if (!trimmedTitle) {
    alert('Please add a title for the task.');
    return;
  }

  if (!trimmedDesc) {
    alert('Please add a description for the task.');
    return;
  }

  if (modal.mode === 'add') {
    const newTask = {
      id: Date.now(),
      title: trimmedTitle,
      description: trimmedDesc,
      priority: modal.priority,
      status: modal.column,
      deleted: false,
      synced: false,
    };

    await db.tasks.add(newTask);

    setTasks(prev => ({
      ...prev,
      [modal.column]: [...prev[modal.column], newTask],
    }));
  } else if (modal.mode === 'edit') {
    await db.tasks.update(modal.taskId, {
      title: trimmedTitle,
      description: trimmedDesc,
      priority: modal.priority,
      synced: false,
    });

    setTasks(prev => ({
      ...prev,
      [modal.column]: prev[modal.column].map(t =>
        t.id === modal.taskId
          ? { ...t, title: trimmedTitle, description: trimmedDesc, priority: modal.priority, synced: false }
          : t
      ),
    }));
  }

  closeModal();
};


  return (
    <div className="app">
      <header className="top-bar">
        <div className="logo-wrap">
          <img src={logoImg} alt="Flowboard logo" className="logo-icon" />
          <div className="logo-text">FLOWBOARD</div>
        </div>

        <div className="status-wrap">
          <div className="status-dot"></div>
          <span className="status-text">
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>

        </div>
      </header>



      <section className="stats-wrapper">
        <div className="stats-row">
          <div className="stat">TOTAL TASKS: {total}</div>
          <div className="stat">IN PROGRESS: {inProgress}</div>
          <div className="stat">COMPLETED: {completed}</div>
        </div>
      </section>

     <main className="columns">
  {['todo', 'inProgress', 'done'].map((colKey) => (
    <div
      className="column"
      key={colKey}
      onDragOver={(e) => e.preventDefault()}

      onDrop={() => {
        if (!dragInfo) return;
        const fromCol = dragInfo.column;
        const toCol = colKey;
        if (fromCol === toCol) return;

        setTasks((prev) => {
          const task = prev[fromCol].find(t => t.id === dragInfo.taskId);
          if (!task) return prev;

          const updatedTask = { ...task, status: toCol };
          db.tasks.update(task.id, { status: toCol, synced: false });

          return {
            ...prev,
            [fromCol]: prev[fromCol].filter(t => t.id !== dragInfo.taskId),
            [toCol]: [...prev[toCol], updatedTask],
          };
        });


        setDragInfo(null);
      }}

    >
      <h2>
        {colKey === 'todo'
          ? 'TO DO'
          : colKey === 'inProgress'
          ? 'IN PROGRESS'
          : 'DONE'}
      </h2>

      {tasks[colKey].map((task) => (
        <div
          className="card"
          key={task.id}
          draggable
          onDragStart={() =>
            setDragInfo({ column: colKey, taskId: task.id })
          }
        >
          <div className="card-actions">
            <button
              className="icon-btn"
              onClick={() => openEditModal(colKey, task)}
            >
              <img src={logoImg2} alt="Edit task" />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleDelete(colKey, task.id)}
            >
              <img src={logoImg1} alt="Delete task" />
            </button>
          </div>

          <div className="card-title">{task.title}</div>
          <textarea
            className="card-notes"
            value={task.description || ''}
            readOnly
          />
          <div className="card-footer">
            <span className="priority">{task.priority}</span>
          </div>
        </div>
      ))}

      <button onClick={() => openAddModal(colKey)}>[+ ADD TASK]</button>
    </div>
  ))}
</main>


      {modal.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <button className="modal-close" onClick={closeModal}>
              ✕
            </button>

            <h2>{modal.mode === 'add' ? 'Add New Task' : 'Edit Task'}</h2>

            <label className="modal-label">
              Task Title
              <input
                className="modal-input"
                placeholder="Enter task title"
                value={modal.title}
                onChange={(e) =>
                  setModal((m) => ({ ...m, title: e.target.value }))
                }
              />
            </label>

            <label className="modal-label">
              Description
              <textarea
                className="modal-textarea"
                placeholder="Add task details"
                value={modal.description}
                onChange={(e) =>
                  setModal((m) => ({ ...m, description: e.target.value }))
                }
              />
            </label>

            <label className="modal-label">
              Priority
              <select
                className="modal-select"
                value={modal.priority}
                onChange={(e) =>
                  setModal((m) => ({ ...m, priority: e.target.value }))
                }
              >
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </label>

            <button className="modal-primary-btn" onClick={handleModalSubmit}>
              {modal.mode === 'add' ? 'Add Task' : 'Edit Task'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
