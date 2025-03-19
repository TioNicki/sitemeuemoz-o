const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const app = express();

// Porta dinâmica para produção (Render)
const port = process.env.PORT || 3000;

// Configuração do PostgreSQL
const client = new Client({
    connectionString: 'postgresql://postgres:HfHwmSznI0eeFFLs@perceptibly-planetary-catbird.data-1.use1.tembo.io:5432/postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000
});

// Conectar ao banco de dados
client.connect()
    .then(() => {
        console.log('Conectado ao banco de dados');
    })
    .catch(err => {
        console.error('Erro ao conectar:', err);
    });

// Configuração do CORS
const corsOptions = {
    origin: '*', // Permite qualquer origem
    methods: ['GET', 'POST', 'DELETE'], // Permite os métodos GET, POST e DELETE
    allowedHeaders: ['Content-Type'], // Permite o cabeçalho Content-Type
    preflightContinue: true, // Habilita a resposta para preflight requests
    optionsSuccessStatus: 204 // Código de status para preflight request
};
app.use(cors(corsOptions));

// Middleware para permitir conexões
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://sitemeuemoz-o.onrender.com;");
    next();
});

// Middleware
app.use(express.static('public'));
app.use(express.json()); // Para processar dados JSON no corpo das requisições

// Rota para adicionar uma notícia
app.post('/add-news', async (req, res) => {
    const { titulo, conteudo } = req.body;

    if (!titulo || !conteudo) {
        return res.status(400).json({ error: 'Título e conteúdo são obrigatórios!' });
    }

    try {
        const result = await client.query(
            'INSERT INTO noticias (titulo, conteudo) VALUES ($1, $2) RETURNING *',
            [titulo, conteudo]
        );
        res.status(201).json(result.rows[0]); // Retorna a notícia inserida
    } catch (err) {
        console.error('Erro ao adicionar notícia:', err);
        res.status(500).json({ error: 'Erro ao adicionar a notícia' });
    }
});

// Rota para recuperar todas as notícias
app.get('/get-news', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM noticias ORDER BY data_criacao DESC');
        res.status(200).json(result.rows); // Retorna todas as notícias
    } catch (err) {
        console.error('Erro ao obter as notícias:', err);
        res.status(500).json({ error: 'Erro ao obter as notícias' });
    }
});

// Rota para excluir uma notícia
app.delete('/delete-news/:id', async (req, res) => {
    const newsId = req.params.id;

    try {
        // Excluindo a notícia com base no ID
        const result = await client.query('DELETE FROM noticias WHERE id = $1 RETURNING *', [newsId]);
        
        if (result.rowCount > 0) {
            return res.json({ message: 'Notícia excluída com sucesso!' });
        } else {
            return res.status(404).json({ message: 'Notícia não encontrada' });
        }
    } catch (error) {
        console.error('Erro ao excluir notícia:', error);
        res.status(500).json({ message: 'Erro ao excluir notícia' });
    }
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
