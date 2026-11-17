import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { Link, useNavigate } from 'react-router';

import { setAuthSessionIfCurrent } from '@/features/auth/store/authSession';

import { CreateSellerForm } from '../components/CreateSellerForm';
import type { CreateSellerProfileResponse } from '../types/sellerProfile.types';

export function CreateSellerPage() {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector((state) => state.auth.sessionId);
  const navigate = useNavigate();

  const handleSuccess = (response: CreateSellerProfileResponse) => {
    if (dispatch(setAuthSessionIfCurrent(response, sessionId))) {
      navigate('/seller', { replace: true });
    }
  };

  return (
    <section className="mx-auto max-w-2xl p-6">
      <Link to="/" className="mb-6 inline-block text-blue-600 hover:underline">
        ← Volver al inicio
      </Link>

      <h1 className="mb-3 text-3xl font-bold">Conviértete en vendedor</h1>

      <p className="mb-8 text-gray-600">
        Crea tu tienda en PokéMarket y empieza a vender tus cartas Pokémon.
      </p>

      <CreateSellerForm onSuccess={handleSuccess} />
    </section>
  );
}
