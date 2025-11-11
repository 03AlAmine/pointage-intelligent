import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import EnrollementModal from './EnrollementModal';

const Dashboard = () => {
  const [pointages, setPointages] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pointages');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [showAddEmploye, setShowAddEmploye] = useState(false);
  const [showEnrollementModal, setShowEnrollementModal] = useState(false);
  const [selectedEmploye, setSelectedEmploye] = useState(null);
  const [newEmploye, setNewEmploye] = useState({ nom: '', email: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [dateFilter, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (activeTab === 'pointages') {
        await loadPointages();
      } else {
        await loadEmployes();
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadPointages = async () => {
    const { data, error } = await supabase
      .from('pointages')
      .select(`
        *,
        employes (
          nom,
          email
        )
      `)
      .gte('timestamp', `${dateFilter}T00:00:00`)
      .lte('timestamp', `${dateFilter}T23:59:59`)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Erreur pointages:', error);
      throw error;
    }
    setPointages(data || []);
  };

  const loadEmployes = async () => {
    const { data, error } = await supabase
      .from('employes')
      .select('*')
      .order('nom', { ascending: true });

    if (error) {
      console.error('Erreur employés:', error);
      throw error;
    }
    setEmployes(data || []);
  };

  const addEmploye = async (e) => {
    e.preventDefault();
    if (!newEmploye.nom.trim() || !newEmploye.email.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    try {
      setError('');
      console.log('🔄 Ajout employé:', newEmploye);

      const { data, error } = await supabase
        .from('employes')
        .insert([{
          nom: newEmploye.nom,
          email: newEmploye.email,
          embedding_facial: [], // Tableau vide pour les non-enrôlés
          photo_url: null,
          date_creation: new Date().toISOString()
        }])
        .select();

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      console.log('✅ Employé ajouté:', data);
      
      setNewEmploye({ nom: '', email: '' });
      setShowAddEmploye(false);
      await loadEmployes();
      
      // Ouvrir directement l'enrôlement pour le nouvel employé
      if (data && data[0]) {
        setSelectedEmploye(data[0]);
        setShowEnrollementModal(true);
      }
      
    } catch (error) {
      console.error('❌ Erreur ajout employé:', error);
      setError(`Erreur lors de l'ajout: ${error.message}`);
    }
  };

  const startEnrollement = (employe) => {
    setSelectedEmploye(employe);
    setShowEnrollementModal(true);
  };

  const handleEnrollementSuccess = () => {
    setShowEnrollementModal(false);
    setSelectedEmploye(null);
    loadEmployes(); // Recharger la liste
  };

  const deleteEmploye = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet employé ? Cette action supprimera aussi tous ses pointages.')) return;

    try {
      setError('');
      
      // Supprimer d'abord les pointages associés
      const { error: errorPointages } = await supabase
        .from('pointages')
        .delete()
        .eq('employe_id', id);

      if (errorPointages) {
        console.warn('Avertissement suppression pointages:', errorPointages);
      }

      // Puis supprimer l'employé
      const { error } = await supabase
        .from('employes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadEmployes();
      
    } catch (error) {
      console.error('Erreur suppression employé:', error);
      setError(`Erreur lors de la suppression: ${error.message}`);
    }
  };

  const exportToCSV = () => {
    try {
      const headers = activeTab === 'pointages' 
        ? ['Nom', 'Email', 'Type', 'Date', 'Heure', 'Confiance']
        : ['Nom', 'Email', 'Date Enrôlement', 'Status'];

      const csvData = activeTab === 'pointages' 
        ? pointages.map(p => [
            p.employes?.nom || 'N/A',
            p.employes?.email || 'N/A',
            p.type,
            new Date(p.timestamp).toLocaleDateString(),
            new Date(p.timestamp).toLocaleTimeString(),
            p.confidence ? `${(p.confidence * 100).toFixed(1)}%` : 'N/A'
          ])
        : employes.map(e => [
            e.nom,
            e.email,
            e.date_creation ? new Date(e.date_creation).toLocaleDateString() : 'N/A',
            e.embedding_facial?.length > 0 ? 'Enrôlé' : 'Non enrôlé'
          ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}-${dateFilter}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Erreur export CSV:', error);
      setError('Erreur lors de l\'export CSV');
    }
  };

  const getStats = () => {
    const totalPointages = pointages.length;
    const entrees = pointages.filter(p => p.type === 'entrée').length;
    const sorties = pointages.filter(p => p.type === 'sortie').length;
    const employesEnroles = employes.filter(e => 
      e.embedding_facial && 
      Array.isArray(e.embedding_facial) && 
      e.embedding_facial.length > 0
    ).length;

    return { 
      totalPointages, 
      entrees, 
      sorties, 
      employesEnroles, 
      totalEmployes: employes.length 
    };
  };

  const stats = getStats();

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>📊 Tableau de Bord Administrateur</h1>
        <div className="header-actions">
          <button onClick={exportToCSV} className="export-btn">
            📥 Exporter CSV
          </button>
          <button onClick={loadData} className="refresh-btn">
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* Affichage des erreurs */}
      {error && (
        <div className="error-banner">
          ❌ {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* Navigation par onglets */}
      <div className="tabs-navigation">
        <button 
          className={`tab-btn ${activeTab === 'pointages' ? 'active' : ''}`}
          onClick={() => setActiveTab('pointages')}
        >
          📅 Pointages
        </button>
        <button 
          className={`tab-btn ${activeTab === 'employes' ? 'active' : ''}`}
          onClick={() => setActiveTab('employes')}
        >
          👥 Employés ({employes.length})
        </button>
      </div>

      {/* Statistiques */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Total Pointages</h3>
            <p className="stat-number">{stats.totalPointages}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🚪</div>
          <div className="stat-content">
            <h3>Entrées</h3>
            <p className="stat-number">{stats.entrees}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🚶</div>
          <div className="stat-content">
            <h3>Sorties</h3>
            <p className="stat-number">{stats.sorties}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Employés Enrôlés</h3>
            <p className="stat-number">{stats.employesEnroles}/{stats.totalEmployes}</p>
          </div>
        </div>
      </div>

      {/* Contenu des onglets */}
      <div className="tab-content">
        {activeTab === 'pointages' && (
          <div className="pointages-section">
            <div className="section-header">
              <h2>📋 Historique des Pointages</h2>
              <div className="filter-section">
                <label>Filtrer par date:</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="date-filter"
                />
              </div>
            </div>

            {loading ? (
              <div className="loading">Chargement des pointages...</div>
            ) : pointages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>Aucun pointage pour cette date</h3>
                <p>Les pointages apparaîtront ici après utilisation du système</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employé</th>
                      <th>Type</th>
                      <th>Date/Heure</th>
                      <th>Confiance</th>
                      <th>Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointages.map((pointage) => (
                      <tr key={pointage.id} className="data-row">
                        <td>
                          <div className="employe-info">
                            <strong>{pointage.employes?.nom || 'N/A'}</strong>
                            <span>{pointage.employes?.email || 'N/A'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${pointage.type}`}>
                            {pointage.type}
                          </span>
                        </td>
                        <td>
                          <div className="datetime-info">
                            <span className="date">{new Date(pointage.timestamp).toLocaleDateString()}</span>
                            <span className="time">{new Date(pointage.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </td>
                        <td>
                          <div className="confidence-level">
                            {pointage.confidence ? (
                              <>
                                <span className="percentage">{(pointage.confidence * 100).toFixed(1)}%</span>
                                <div className="confidence-bar">
                                  <div 
                                    className="confidence-fill"
                                    style={{ width: `${pointage.confidence * 100}%` }}
                                  ></div>
                                </div>
                              </>
                            ) : (
                              <span className="na">N/A</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {pointage.photo_capture_url && (
                            <img 
                              src={pointage.photo_capture_url} 
                              alt="Capture" 
                              className="capture-thumbnail"
                              onClick={() => window.open(pointage.photo_capture_url, '_blank')}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'employes' && (
          <div className="employes-section">
            <div className="section-header">
              <h2>👥 Gestion des Employés</h2>
              <button 
                onClick={() => setShowAddEmploye(true)}
                className="add-btn"
              >
                ➕ Ajouter un employé
              </button>
            </div>

            {/* Formulaire d'ajout */}
            {showAddEmploye && (
              <div className="add-employe-form">
                <h3>Nouvel Employé</h3>
                <form onSubmit={addEmploye}>
                  <div className="form-row">
                    <input
                      type="text"
                      placeholder="Nom complet"
                      value={newEmploye.nom}
                      onChange={(e) => setNewEmploye({...newEmploye, nom: e.target.value})}
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={newEmploye.email}
                      onChange={(e) => setNewEmploye({...newEmploye, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="primary-btn">
                      ✅ Ajouter et Enrôler
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowAddEmploye(false)}
                      className="secondary-btn"
                    >
                      ❌ Annuler
                    </button>
                  </div>
                </form>
                <div className="form-info">
                  <p>💡 L'employé sera ajouté et l'enrôlement photo démarrera automatiquement.</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="loading">Chargement des employés...</div>
            ) : employes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>Aucun employé enregistré</h3>
                <p>Ajoutez des employés pour commencer à utiliser le système</p>
                <button 
                  onClick={() => setShowAddEmploye(true)}
                  className="primary-btn"
                  style={{marginTop: '15px'}}
                >
                  ➕ Ajouter le premier employé
                </button>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employé</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Date d'enrôlement</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employes.map((employe) => (
                      <tr key={employe.id} className="data-row">
                        <td>
                          <div className="employe-info">
                            {employe.photo_url ? (
                              <img 
                                src={employe.photo_url} 
                                alt={employe.nom}
                                className="employe-avatar"
                              />
                            ) : (
                              <div className="employe-avatar placeholder">
                                👤
                              </div>
                            )}
                            <div className="employe-details">
                              <strong>{employe.nom}</strong>
                              <span className="employe-id">ID: {employe.id.substring(0, 8)}...</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="contact-info">
                            <div className="email">{employe.email}</div>
                          </div>
                        </td>
                        <td>
                          <div className="status-container">
                            <span className={`status-badge ${
                              employe.embedding_facial?.length > 0 ? 'enrolled' : 'pending'
                            }`}>
                              {employe.embedding_facial?.length > 0 ? '✅ Enrôlé' : '⏳ En attente'}
                            </span>
                          </div>
                        </td>
                        <td>
                          {employe.date_creation 
                            ? new Date(employe.date_creation).toLocaleDateString()
                            : 'N/A'
                          }
                        </td>
                        <td>
                          <div className="action-buttons">
                            {(!employe.embedding_facial || employe.embedding_facial.length === 0) ? (
                              <button 
                                onClick={() => startEnrollement(employe)}
                                className="enroll-btn"
                                title="Compléter l'enrôlement"
                              >
                                📸 Enrôler
                              </button>
                            ) : (
                              <button 
                                onClick={() => startEnrollement(employe)}
                                className="re-enroll-btn"
                                title="Ré-enrôler (nouvelle photo)"
                              >
                                🔄 Mettre à jour
                              </button>
                            )}
                            <button 
                              onClick={() => deleteEmploye(employe.id)}
                              className="delete-btn"
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal d'enrôlement */}
      {showEnrollementModal && selectedEmploye && (
        <EnrollementModal
          employe={selectedEmploye}
          onSuccess={handleEnrollementSuccess}
          onClose={() => {
            setShowEnrollementModal(false);
            setSelectedEmploye(null);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;