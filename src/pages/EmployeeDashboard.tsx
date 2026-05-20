import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, List, LogOut, CheckCircle2, Search, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

type OrderItem = {
  id: string;
  productName: string;
  description: string;
  vendorName: string;
  quantity: number | '';
  price: number | '';
};

type Ticket = {
  id: string;
  customerName: string;
  purchaseOrderNumber?: string;
  requesterName?: string;
  requesterPhone?: string;
  ticketDate: string;
  handoverDate: string;
  items: Array<{ id: string, productName: string, description?: string, vendorName?: string, quantity: number, price: number }>;
  employeeId: string;
  employeeName: string;
};

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [handoverDate, setHandoverDate] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ id: uuidv4(), productName: '', description: '', vendorName: '', quantity: 1, price: 0 }]);
  const [productsList, setProductsList] = useState<string[]>([]);
  const [customersList, setCustomersList] = useState<string[]>([]);
  const [vendorsList, setVendorsList] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Autocomplete states
  const [activeDropdown, setActiveDropdown] = useState<{ id: string, type: 'product' | 'vendor' | 'customer' } | null>(null);

  // My Tickets Tab States
  const [activeTab, setActiveTab] = useState<'raise' | 'mine'>('raise');
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');

  useEffect(() => {
    if (activeTab === 'raise') {
      fetchProducts();
      fetchCustomers();
      fetchVendors();
    } else {
      fetchMyTickets();
    }
  }, [activeTab]);

  const fetchMyTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const allTickets: Ticket[] = await res.json();
        // filter tickets for this employee
        setMyTickets(allTickets.filter(t => t.employeeId === user?.id));
      }
    } catch (err) { console.error(err); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      setProductsList(await res.json());
    } catch (err) { console.error(err); }
  };
  
  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      setCustomersList(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/vendors');
      setVendorsList(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleBlur = async (type: 'product' | 'vendor' | 'customer', value: string) => {
    setTimeout(() => setActiveDropdown(null), 200);
    const cleanName = value.trim();
    if (!cleanName) return;

    try {
      if (type === 'product' && !productsList.some(p => p.toLowerCase() === cleanName.toLowerCase())) {
        await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName }) });
        setProductsList(prev => [...prev, cleanName]);
      } else if (type === 'vendor' && !vendorsList.some(v => v.toLowerCase() === cleanName.toLowerCase())) {
        await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName }) });
        setVendorsList(prev => [...prev, cleanName]);
      } else if (type === 'customer' && !customersList.some(c => c.toLowerCase() === cleanName.toLowerCase())) {
        await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName }) });
        setCustomersList(prev => [...prev, cleanName]);
      }
    } catch (err) {
      console.error(`Failed to dynamically add ${type}`, err);
    }
  };

  const currentFormattedDate = format(new Date(), 'yyyy-MM-dd');

  const addItem = () => {
    setItems([...items, { id: uuidv4(), productName: '', description: '', vendorName: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');

    const newTicket = {
      customerName,
      purchaseOrderNumber,
      requesterName,
      requesterPhone,
      ticketDate: new Date().toISOString(),
      handoverDate,
      items: items.map(item => ({
        ...item,
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0
      })),
      employeeId: user?.id,
      employeeName: user?.username,
    };

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      });

      if (res.ok) {
        setSuccessMsg('Ticket raised successfully!');
        setCustomerName('');
        setPurchaseOrderNumber('');
        setRequesterName('');
        setRequesterPhone('');
        setHandoverDate('');
        setItems([{ id: uuidv4(), productName: '', description: '', vendorName: '', quantity: 1, price: 0 }]);
        fetchProducts(); 
        fetchCustomers();
        fetchVendors();
        setActiveTab('mine'); // switch back to my tickets maybe? Let's stay on Raise but clear form
      }
    } catch (error) {
      console.error("Failed to submit ticket", error);
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  const filteredTickets = myTickets.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchText = (t.customerName?.toLowerCase() || '').includes(term) ||
                      (t.purchaseOrderNumber?.toLowerCase() || '').includes(term) ||
                      (t.requesterName?.toLowerCase() || '').includes(term);
    const matchDate = searchDate ? t.handoverDate === searchDate || t.ticketDate.startsWith(searchDate) : true;
    return matchText && matchDate;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Employee Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Logged in as: {user?.username}</span>
            <button
              onClick={logout}
              className="flex items-center text-sm text-gray-500 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('raise')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === 'raise'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm border border-gray-200'
            }`}
          >
            Raise Ticket
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === 'mine'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm border border-gray-200'
            }`}
          >
            My Tickets
          </button>
        </div>

        {activeTab === 'raise' ? (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">Raise New Job Ticket</h2>
            
            {successMsg && (
              <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2" /> {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer / Company Name</label>
                <div className="flex w-full">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setActiveDropdown({ id: 'customer', type: 'customer' });
                      }}
                      onFocus={() => setActiveDropdown({ id: 'customer', type: 'customer' })}
                      onBlur={() => handleBlur('customer', customerName)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g. Acme Corp"
                    />
                    {activeDropdown?.id === 'customer' && activeDropdown?.type === 'customer' && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {customersList
                          .filter(c => !customerName || c.toLowerCase().includes(customerName.toLowerCase()))
                          .map(c => (
                            <div
                              key={c}
                              className="px-4 py-2 cursor-pointer hover:bg-gray-50 text-sm"
                              onClick={() => {
                                setCustomerName(c);
                                setActiveDropdown(null);
                              }}
                            >
                              {c}
                            </div>
                          ))}
                        {customerName && !customersList.some(c => c.toLowerCase() === customerName.toLowerCase()) && (
                          <div className="px-4 py-2 text-sm text-blue-600 italic">
                            + Add "{customerName}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown?.id === 'customer' ? null : { id: 'customer', type: 'customer' })}
                    className="bg-gray-100 border border-l-0 border-gray-300 px-3 rounded-r-lg hover:bg-gray-200 flex items-center justify-center flex-shrink-0"
                    title="View all customers"
                  >
                    <List className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order Number</label>
                <input
                  type="text"
                  value={purchaseOrderNumber}
                  onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                  placeholder="e.g. PO-12345 (Optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Date (Today)</label>
                <input
                  type="text"
                  readOnly
                  value={currentFormattedDate}
                  className="w-full px-4 py-2 border rounded-lg border-gray-300 bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requester Name</label>
                <input
                  type="text"
                  required
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                  placeholder="Name of the person requesting"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requester Phone Number</label>
                <input
                  type="tel"
                  required
                  value={requesterPhone}
                  onChange={(e) => setRequesterPhone(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                  placeholder="e.g. +1 234 567 8900"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-lg font-medium text-gray-800">Order Items</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Row
                </button>
              </div>
              
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b grid grid-cols-12 gap-2 text-sm font-semibold text-gray-600 p-3 hidden md:grid">
                  <div className="col-span-6">Product Name</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-3">Price</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <div key={item.id} className="p-3 border-b last:border-b-0 border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start md:items-center mb-4">
                        <div className="col-span-1 md:col-span-6 relative">
                          <label className="text-xs text-gray-500 mb-1 block md:hidden">Product Name</label>
                          <div className="flex w-full">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                required
                                value={item.productName}
                                onChange={(e) => {
                                  updateItem(item.id, 'productName', e.target.value);
                                  setActiveDropdown({ id: item.id, type: 'product' });
                                }}
                                onFocus={() => setActiveDropdown({ id: item.id, type: 'product' })}
                                onBlur={() => handleBlur('product', item.productName)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Type or select product..."
                              />
                              {activeDropdown?.id === item.id && activeDropdown?.type === 'product' && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                  {productsList
                                    .filter(p => !item.productName || p.toLowerCase().includes(item.productName.toLowerCase()))
                                    .map(p => (
                                      <div
                                        key={p}
                                        className="px-4 py-2 cursor-pointer hover:bg-gray-50 text-sm"
                                        onClick={() => {
                                          updateItem(item.id, 'productName', p);
                                          setActiveDropdown(null);
                                        }}
                                      >
                                        {p}
                                      </div>
                                    ))}
                                  {item.productName && !productsList.some(p => p.toLowerCase() === item.productName.toLowerCase()) && (
                                    <div className="px-4 py-2 text-sm text-blue-600 italic">
                                      + Add "{item.productName}"
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveDropdown(activeDropdown?.id === item.id && activeDropdown.type === 'product' ? null : { id: item.id, type: 'product' })}
                              className="bg-gray-100 border border-l-0 border-gray-300 px-3 rounded-r-lg hover:bg-gray-200 flex items-center justify-center flex-shrink-0"
                              title="View all products"
                            >
                              <List className="h-4 w-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="col-span-1 md:col-span-2">
                           <label className="text-xs text-gray-500 mb-1 block md:hidden">Quantity</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div className="col-span-1 md:col-span-3 border-l-0">
                           <label className="text-xs text-gray-500 mb-1 block md:hidden">Price</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">₹</span>
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                              className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                            className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed p-2 rounded-full hover:bg-red-50 transition"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {/* Sub-row for Description and Outsource Vendor */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="col-span-1 md:col-span-6">
                           <label className="text-xs text-gray-500 mb-1 block">Description</label>
                           <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                              placeholder="Product details, configuration, notes..."
                            />
                        </div>
                        <div className="col-span-1 md:col-span-5 relative">
                          <label className="text-xs text-gray-500 mb-1 block">Outsource Vendor (Optional)</label>
                          <div className="flex w-full">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={item.vendorName}
                                onChange={(e) => {
                                  updateItem(item.id, 'vendorName', e.target.value);
                                  setActiveDropdown({ id: item.id, type: 'vendor' });
                                }}
                                onFocus={() => setActiveDropdown({ id: item.id, type: 'vendor' })}
                                onBlur={() => handleBlur('vendor', item.vendorName)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                placeholder="Vendor if outsourced..."
                              />
                              {activeDropdown?.id === item.id && activeDropdown?.type === 'vendor' && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                  {vendorsList
                                    .filter(v => !item.vendorName || v.toLowerCase().includes(item.vendorName.toLowerCase()))
                                    .map(v => (
                                      <div
                                        key={v}
                                        className="px-4 py-2 cursor-pointer hover:bg-gray-50 text-sm"
                                        onClick={() => {
                                          updateItem(item.id, 'vendorName', v);
                                          setActiveDropdown(null);
                                        }}
                                      >
                                        {v}
                                      </div>
                                    ))}
                                  {item.vendorName && !vendorsList.some(v => v.toLowerCase() === item.vendorName.toLowerCase()) && (
                                    <div className="px-4 py-2 text-sm text-blue-600 italic">
                                      + Add "{item.vendorName}"
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveDropdown(activeDropdown?.id === item.id && activeDropdown.type === 'vendor' ? null : { id: item.id, type: 'vendor' })}
                              className="bg-gray-100 border border-l-0 border-gray-300 px-3 rounded-r-lg hover:bg-gray-200 flex items-center justify-center flex-shrink-0"
                              title="View all vendors"
                            >
                              <List className="h-4 w-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Handover / Delivery Date</label>
              <input
                type="date"
                required
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                className="w-full md:w-1/3 px-4 py-2 border rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="pt-6 flex justify-end">
              <button
                type="submit"
                disabled={submitting || items.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition"
              >
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-800">My Raised Tickets</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search company, PO, name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full sm:w-40 pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm text-gray-600"
                    title="Filter by handover date"
                  />
                  {searchDate && (
                    <button
                      onClick={() => setSearchDate('')}
                      className="absolute right-2 top-2.5 text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No tickets found</h3>
                  <p className="text-gray-500 text-sm">
                    {searchTerm || searchDate 
                      ? "Try adjusting your search filters or clearing the date." 
                      : "You haven't raised any tickets yet."}
                  </p>
                </div>
              ) : (
                filteredTickets.sort((a, b) => new Date(b.ticketDate).getTime() - new Date(a.ticketDate).getTime()).map(ticket => (
                  <div key={ticket.id} className="bg-white min-w-full overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                    {/* Ticket Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b flex flex-wrap gap-4 justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                          {ticket.customerName || <span className="italic text-gray-400">No Company Name</span>}
                          {ticket.purchaseOrderNumber && (
                            <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2 py-0.5 rounded">PO: {ticket.purchaseOrderNumber}</span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Raised on {format(parseISO(ticket.ticketDate), 'MMM d, yyyy h:mm a')}
                        </p>
                        {(ticket.requesterName || ticket.requesterPhone) && (
                          <p className="text-xs text-gray-500 mt-1">
                            Requested by: <span className="font-medium text-gray-700">{ticket.requesterName}</span> {ticket.requesterPhone && `(${ticket.requesterPhone})`}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">Handover Date</span>
                        <span className="font-bold text-blue-600">{format(parseISO(ticket.handoverDate), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    
                    {/* Ticket Items */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Unit</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 pb-2">
                          {ticket.items.map((item, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2 whitespace-normal text-gray-800 font-medium">
                                {item.productName}
                                {(item.description || item.vendorName) && (
                                  <div className="text-xs text-gray-500 font-normal mt-1 space-y-0.5">
                                    {item.description && <span className="block">{item.description}</span>}
                                    {item.vendorName && <span className="block text-indigo-500">Outsourced: {item.vendorName}</span>}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-center text-gray-600 align-top">{item.quantity}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-right text-gray-600 align-top">₹{Number(item.price).toFixed(2)}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-right text-gray-800 font-medium align-top">₹{(item.quantity * Number(item.price)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50/80">
                          <tr>
                             <td colSpan={3} className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Grand Total</td>
                             <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-bold text-gray-900 border-t border-gray-200">
                               ₹{ticket.items.reduce((sum, item) => sum + (item.quantity * Number(item.price)), 0).toFixed(2)}
                             </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
