const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const app = express();
const port = 3000;


const corsOptions = {
    origin: ['http://192.168.18.26:5500', 'https://meuam0r.netlify.app'], // Adicione as origens necessárias
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};


app.use(cors(corsOptions));

app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src *;");
    next();
});

// Middleware para permitir conexões
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://sitemeuemoz-o.onrender.com/;");
    next();
});

// Middleware
app.use(express.static('public'));
app.use(express.json()); // Para processar dados JSON no corpo das requisições

app.use((req, res, next) => {
    console.log("CORS Headers:", res.getHeaders());
    next();
});

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' https://www.gstatic.com;");
    next();
});

// Configuração do PostgreSQL
const client = new Client({
    connectionString: 'postgresql://postgres:HfHwmSznI0eeFFLs@perceptibly-planetary-catbird.data-1.use1.tembo.io:5432/postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000
});

client.connect()
    .then(() => {
        console.log('Conectado ao banco de dados');
    })
    .catch(err => {
        console.error('Erro ao conectar:', err);
    });

    // Rota para adicionar uma missão
    app.post('/add-missao', async (req, res) => {
        const { titulo, descricao, recompensa } = req.body;
    
        if (!titulo || !descricao || !recompensa) {
            return res.status(400).json({ error: 'Título, descrição e recompensa são obrigatórios!' });
        }
    
        try {
            // Defina o status como 'disponível' por padrão
            const result = await client.query(
                'INSERT INTO missoes (titulo, descricao, recompensa, status) VALUES ($1, $2, $3, $4) RETURNING *',
                [titulo, descricao, recompensa, 'disponível']  // Aqui está o valor 'disponível'
            );
            res.status(201).json(result.rows[0]); // Retorna a missão adicionada
        } catch (err) {
            console.error('Erro ao adicionar missão:', err);
            res.status(500).json({ error: 'Erro ao adicionar a missão' });
        }
    });
// Rota para recuperar todas as missões
app.get('/get-missoes', async (req, res) => {
    try {
        const result = await client.query('SELECT id, titulo, descricao, status, recompensa, hora_publicada, hora_aceita FROM missoes');
        
        console.log(result.rows); // Verifique o que está sendo retornado
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar missões:', err);
        res.status(500).json({ error: 'Erro ao buscar missões' });
    }
});
app.put('/aceitar-missao/:id', async (req, res) => {
    const missionId = req.params.id;
    const horaAceita = new Date().toISOString(); // Salva no formato UTC

    try {
        const result = await client.query(
            'UPDATE missoes SET status = $1, hora_aceita = $2 WHERE id = $3 RETURNING *',
            ['em andamento', horaAceita, missionId]
        );

        if (result.rowCount > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Missão não encontrada' });
        }
    } catch (err) {
        console.error('Erro ao aceitar missão:', err);
        res.status(500).json({ error: 'Erro ao aceitar missão' });
    }
});
// Rota para atualizar o status de uma missão
app.put('/update-missao/:id', async (req, res) => {
    const missionId = req.params.id;
    const { titulo, descricao, status } = req.body;

    try {
        let query = `
            UPDATE missoes 
            SET titulo = $1, descricao = $2, status = $3
        `;
        let values = [titulo, descricao, status];

        // Se a missão for aceita, salvar a hora_aceita
        if (status.toLowerCase() === 'aceita') {
            query += `, hora_aceita = NOW() AT TIME ZONE 'UTC'`;
        }

        query += ` WHERE id = $${values.length + 1} RETURNING *`;
        values.push(missionId);

        const result = await client.query(query, values);

        if (result.rowCount > 0) {
            res.status(200).json(result.rows[0]); // Retorna a missão atualizada
        } else {
            res.status(404).json({ message: 'Missão não encontrada' });
        }
    } catch (err) {
        console.error('Erro ao atualizar missão:', err);
        res.status(500).json({ error: 'Erro ao atualizar missão' });
    }
});
// Rota para excluir uma missão
app.delete('/delete-missao/:id', async (req, res) => {
    const missionId = req.params.id;

    try {
        const result = await client.query(
            'DELETE FROM missoes WHERE id = $1 RETURNING *',
            [missionId]
        );

        if (result.rowCount > 0) {
            res.status(200).json({ message: 'Missão excluída com sucesso!' });
        } else {
            res.status(404).json({ message: 'Missão não encontrada' });
        }
    } catch (err) {
        console.error('Erro ao excluir missão:', err);
        res.status(500).json({ error: 'Erro ao excluir missão' });
    }
});
// Rota para alterar apenas o status e salvar hora_concluida, se aplicável
app.put('/alterar-status/:id', async (req, res) => {
    const missionId = req.params.id;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status é obrigatório' });
    }

    try {
        let query;
        let values;

        if (status.toLowerCase() === 'concluída' || status.toLowerCase() === 'concluido') {
            query = 'UPDATE missoes SET status = $1, hora_concluida = NOW() AT TIME ZONE \'UTC\' WHERE id = $2 RETURNING *';
            values = [status, missionId];
        } else {
            query = 'UPDATE missoes SET status = $1 WHERE id = $2 RETURNING *';
            values = [status, missionId];
        }

        const result = await client.query(query, values);

        if (result.rowCount > 0) {
            res.status(200).json({ message: 'Status atualizado com sucesso', missao: result.rows[0] });
        } else {
            res.status(404).json({ error: 'Missão não encontrada' });
        }
    } catch (err) {
        console.error('Erro ao atualizar status:', err);
        res.status(500).json({ error: 'Erro ao atualizar status da missão' });
    }
});
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

// Rota para salvar o resultado de um giro na roleta
app.post('/salvar-roleta', cors(corsOptions), async (req, res) => {
    const { item_sorteado } = req.body;
    if (!item_sorteado) {
        return res.status(400).json({ error: 'O item sorteado é obrigatório' });
    }

    try {
        const query = 'INSERT INTO roleta_resultados (item_sorteado, data_sorteio) VALUES ($1, NOW())';
        await client.query(query, [item_sorteado]); // Usando 'client' para realizar a query
        res.json({ success: true, message: 'Resultado salvo com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar o resultado da roleta:', error);
        res.status(500).json({ error: 'Erro ao salvar resultado no banco de dados' });
    }
});

app.get('/historico', async (req, res) => {
    try {
        // Consulta os resultados da roleta
        const result = await client.query('SELECT item_sorteado, data_sorteio FROM roleta_resultados ORDER BY data_sorteio DESC LIMIT 10');
        
        // Retorna os dados com a hora exata (em UTC), sem alterações
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao consultar os resultados:', err);
        res.status(500).json({ error: 'Erro ao consultar os resultados' });
    }
});

// Rota para adicionar uma novidade
app.post('/add-novidade', async (req, res) => {
    const { content } = req.body; // O conteúdo da novidade será enviado no corpo da requisição

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Conteúdo da novidade é obrigatório!' });
    }

    try {
        // Insere a novidade na tabela 'novidades'
        const result = await client.query(
            'INSERT INTO novidades (conteudo) VALUES ($1) RETURNING *',
            [content] // O conteúdo enviado pela requisição
        );

        // Retorna a novidade inserida
        res.status(201).json({
            success: true,
            message: 'Novidade adicionada com sucesso!',
            data: result.rows[0] // Retorna a novidade inserida
        });
    } catch (err) {
        console.error('Erro ao adicionar novidade:', err);
        res.status(500).json({ error: 'Erro ao adicionar a novidade' });
    }
});
// Rota para recuperar todas as novidades
app.get('/get-novidades', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM novidades ORDER BY data_criacao DESC');
        res.status(200).json(result.rows); // Retorna todas as novidades ordenadas pela data de criação
    } catch (err) {
        console.error('Erro ao obter as novidades:', err);
        res.status(500).json({ error: 'Erro ao obter as novidades' });
    }
});
// Rota para excluir a novidade
app.delete('/delete-novidade/:id', async (req, res) => {
    const { id } = req.params; // Obtém o ID da novidade da URL

    try {
        // Deleta a novidade com o ID fornecido
        const result = await client.query(
            'DELETE FROM novidades WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rowCount > 0) {
            // Se a novidade foi deletada com sucesso
            res.status(200).json({
                success: true,
                message: 'Novidade excluída com sucesso!',
            });
        } else {
            // Se não foi encontrada a novidade com o ID fornecido
            res.status(404).json({
                success: false,
                message: 'Novidade não encontrada.',
            });
        }
    } catch (err) {
        console.error('Erro ao excluir novidade:', err);
        res.status(500).json({ error: 'Erro ao excluir a novidade' });
    }
});
// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
